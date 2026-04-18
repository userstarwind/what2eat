import asyncio
import json
import logging
from pathlib import Path
from uuid import UUID, uuid4

from redis.asyncio import Redis
from sqlalchemy import insert, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from src.auth.models import User

from .config import food_settings
from .emb.client import request_embeddings
from .emb.queue import enqueue_food_embedding_jobs_batch
from .enum import (
    ConvenienceEnum,
    CuisineEnum,
    FoodStatusEnum,
    MealTypeEnum,
    PriceRangeEnum,
)
from .exceptions import (
    FoodAlreadyExistsException,
    FoodNotFoundException,
    InvalidDefaultFoodDataException,
)
from .models import Food, utcnow
from .schemas import DefaultFoodItem, FoodCreate, FoodUpdate

logger = logging.getLogger(__name__)

_EMBEDDING_SOURCE_FIELDS = {
    "name",
    "description",
    "cuisine",
    "meal_type",
    "price_range",
    "convenience",
}


def _resolve_food_status(
    embedding: list[float] | None,
    status: FoodStatusEnum | None,
) -> FoodStatusEnum:
    if status is not None:
        return status
    if embedding:
        return FoodStatusEnum.ACTIVE
    return FoodStatusEnum.WAIT_FOR_PROCESS


def _build_default_food_embedding_source(item: DefaultFoodItem) -> str:
    return "\n".join(
        [
            f"name: {item.name}",
            f"description: {item.description or ''}",
            f"cuisine: {item.cuisine.value if item.cuisine else ''}",
            f"meal_type: {item.meal_type.value if item.meal_type else ''}",
            f"price_range: {item.price_range.value}",
            f"convenience: {item.convenience.value}",
        ]
    )


def _read_default_food_items_from_disk(default_food_path: Path) -> list[DefaultFoodItem]:
    try:
        raw_items = json.loads(default_food_path.read_text(encoding="utf-8"))
        return [DefaultFoodItem.model_validate(item) for item in raw_items]
    except (OSError, ValueError, TypeError) as exc:
        raise InvalidDefaultFoodDataException() from exc


def _write_default_food_items_to_disk(
    default_food_path: Path,
    items: list[DefaultFoodItem],
) -> None:
    try:
        default_food_path.write_text(
            json.dumps(
                [item.model_dump(mode="json", exclude_none=True) for item in items],
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
    except OSError as exc:
        raise InvalidDefaultFoodDataException() from exc


async def load_default_food_items() -> list[DefaultFoodItem]:
    items = await asyncio.to_thread(
        _read_default_food_items_from_disk,
        food_settings.default_food_path,
    )
    logger.info("Loaded %s default food items from %s.", len(items), food_settings.default_food_path)
    return items


async def ensure_default_food_cache() -> None:
    default_items = await load_default_food_items()
    items_to_generate = default_items if not food_settings.use_cache else [
        item for item in default_items if item.embedding is None
    ]
    should_persist = bool(items_to_generate)

    if items_to_generate:
        if food_settings.use_cache:
            logger.info(
                "Detected %s default foods without cached embeddings. Generating now.",
                len(items_to_generate),
            )
        else:
            logger.info(
                "use_cache is disabled. Regenerating embeddings for all %s default foods.",
                len(items_to_generate),
            )

        embeddings = await request_embeddings(
            [_build_default_food_embedding_source(item) for item in items_to_generate]
        )

        if food_settings.use_cache:
            embedding_iter = iter(embeddings)
            hydrated_items: list[DefaultFoodItem] = []
            for item in default_items:
                embedding = item.embedding
                if embedding is None:
                    embedding = next(embedding_iter)
                hydrated_items.append(
                    item.model_copy(
                        update={
                            "embedding": embedding,
                            "status": _resolve_food_status(embedding, item.status),
                        }
                    )
                )
            default_items = hydrated_items
        else:
            default_items = [
                item.model_copy(
                    update={
                        "embedding": embedding,
                        "status": _resolve_food_status(embedding, item.status),
                    }
                )
                for item, embedding in zip(default_items, embeddings, strict=True)
            ]

    normalized_items: list[DefaultFoodItem] = []
    for item in default_items:
        normalized_status = _resolve_food_status(item.embedding, item.status)
        if normalized_status != item.status:
            should_persist = True
            item = item.model_copy(update={"status": normalized_status})
        normalized_items.append(item)

    if should_persist:
        await asyncio.to_thread(
            _write_default_food_items_to_disk,
            food_settings.default_food_path,
            normalized_items,
        )
        logger.info("Default food cache has been refreshed on startup.")
    else:
        logger.info("Default food cache is already up to date.")


def food_requires_embedding(food: Food) -> bool:
    return food.embedding is None and food.status == FoodStatusEnum.WAIT_FOR_PROCESS


def _prepare_food_for_embedding_refresh(food: Food) -> None:
    food.embedding = None
    food.status = FoodStatusEnum.WAIT_FOR_PROCESS
    food.version += 1


async def mark_food_embedding_failed(
    session: AsyncSession,
    food_id: UUID,
    user_id: UUID,
    version: int,
) -> None:
    await session.execute(
        update(Food)
        .where(Food.id == food_id, Food.user_id == user_id, Food.version == version)
        .values(
            status=FoodStatusEnum.FAILED,
            updated_at=utcnow(),
        )
    )
    await session.commit()


async def enqueue_food_embedding_jobs(
    session: AsyncSession,
    redis: Redis,
    foods: list[Food],
    *,
    trigger: str,
) -> None:
    foods_to_enqueue = [food for food in foods if food_requires_embedding(food)]
    if not foods_to_enqueue:
        logger.info("Finished enqueue pass trigger=%s total_foods=%s enqueued=0.", trigger, len(foods))
        return

    try:
        await enqueue_food_embedding_jobs_batch(
            redis,
            [
                {
                    "food_id": str(food.id),
                    "user_id": str(food.user_id),
                    "version": str(food.version),
                    "attempt": "0",
                    "trigger": trigger,
                }
                for food in foods_to_enqueue
            ],
        )
        for food in foods_to_enqueue:
            logger.info(
                "Enqueued embedding job for food_id=%s user_id=%s version=%s trigger=%s.",
                food.id,
                food.user_id,
                food.version,
                trigger,
            )
    except Exception:
        logger.exception(
            "Failed to batch enqueue embedding jobs trigger=%s count=%s.",
            trigger,
            len(foods_to_enqueue),
        )
        for food in foods_to_enqueue:
            await mark_food_embedding_failed(session, food.id, food.user_id, food.version)
            await session.refresh(food)

    logger.info(
        "Finished enqueue pass trigger=%s total_foods=%s enqueued=%s.",
        trigger,
        len(foods),
        len(foods_to_enqueue),
    )


async def seed_default_foods_for_user(session: AsyncSession, user: User) -> list[Food]:
    default_items = await load_default_food_items()
    cached_items = [item for item in default_items if item.embedding is not None]
    uncached_items = [item for item in default_items if item.embedding is None]
    logger.info(
        "Seeding default foods for user_id=%s total=%s cached=%s uncached=%s.",
        user.id,
        len(default_items),
        len(cached_items),
        len(uncached_items),
    )

    if cached_items:
        cached_rows = [
            {
                "id": uuid4(),
                "name": item.name,
                "description": item.description,
                "cuisine": item.cuisine,
                "meal_type": item.meal_type,
                "price_range": item.price_range,
                "convenience": item.convenience,
                "status": _resolve_food_status(item.embedding, item.status),
                "version": 1,
                "is_favorite": False,
                "is_recycled": False,
                "embedding": item.embedding,
                "user_id": user.id,
                "created_at": utcnow(),
                "updated_at": utcnow(),
            }
            for item in cached_items
        ]
        logger.info(
            "Bulk inserting %s cached default foods for user_id=%s.",
            len(cached_rows),
            user.id,
        )
        await session.execute(insert(Food), cached_rows)
        logger.info(
            "Bulk insert completed for %s cached default foods user_id=%s.",
            len(cached_rows),
            user.id,
        )

    foods_to_enqueue = [
        Food(
            name=item.name,
            description=item.description,
            cuisine=item.cuisine,
            meal_type=item.meal_type,
            price_range=item.price_range,
            convenience=item.convenience,
            status=_resolve_food_status(item.embedding, item.status),
            embedding=item.embedding,
            user_id=user.id,
        )
        for item in uncached_items
    ]
    if foods_to_enqueue:
        logger.info(
            "Adding %s uncached default foods through ORM for user_id=%s.",
            len(foods_to_enqueue),
            user.id,
        )
        session.add_all(foods_to_enqueue)
        await session.flush()
        logger.info(
            "ORM flush completed for %s uncached default foods user_id=%s.",
            len(foods_to_enqueue),
            user.id,
        )

    logger.info(
        "Prepared %s default foods for user_id=%s cached=%s uncached=%s.",
        len(default_items),
        user.id,
        len(cached_items),
        len(uncached_items),
    )
    return foods_to_enqueue


async def get_food_by_id(
    session: AsyncSession,
    user_id: UUID,
    food_id: UUID,
) -> Food:
    statement = select(Food).where(Food.id == food_id, Food.user_id == user_id)
    result = await session.execute(statement)
    food = result.scalar_one_or_none()
    if food is None:
        logger.warning("Food not found food_id=%s user_id=%s.", food_id, user_id)
        raise FoodNotFoundException()
    return food


async def list_foods(
    session: AsyncSession,
    user_id: UUID,
    *,
    keyword: str | None = None,
    favorites_only: bool = False,
    include_recycled: bool = False,
    recycled_only: bool = False,
    cuisine: CuisineEnum | None = None,
    meal_type: MealTypeEnum | None = None,
    price_range: PriceRangeEnum | None = None,
    convenience: ConvenienceEnum | None = None,
    status: FoodStatusEnum | None = None,
) -> list[Food]:
    statement = select(Food).where(Food.user_id == user_id)

    if recycled_only:
        statement = statement.where(Food.is_recycled.is_(True))
    elif not include_recycled:
        statement = statement.where(Food.is_recycled.is_(False))

    if favorites_only:
        statement = statement.where(Food.is_favorite.is_(True))

    if keyword:
        normalized_keyword = f"%{keyword.strip()}%"
        statement = statement.where(
            (Food.name.ilike(normalized_keyword))
            | (Food.description.ilike(normalized_keyword))
        )

    if cuisine is not None:
        statement = statement.where(Food.cuisine == cuisine)
    if meal_type is not None:
        statement = statement.where(Food.meal_type == meal_type)
    if price_range is not None:
        statement = statement.where(Food.price_range == price_range)
    if convenience is not None:
        statement = statement.where(Food.convenience == convenience)
    if status is not None:
        statement = statement.where(Food.status == status)

    statement = statement.order_by(Food.is_favorite.desc(), Food.updated_at.desc())
    result = await session.execute(statement)
    foods = list(result.scalars().all())
    logger.info(
        "Query returned %s foods for user_id=%s favorites_only=%s recycled_only=%s include_recycled=%s.",
        len(foods),
        user_id,
        favorites_only,
        recycled_only,
        include_recycled,
    )
    return foods


async def create_food(
    session: AsyncSession,
    redis: Redis,
    user: User,
    payload: FoodCreate,
) -> Food:
    food = Food(
        **payload.model_dump(),
        user_id=user.id,
        embedding=None,
        status=FoodStatusEnum.WAIT_FOR_PROCESS,
        version=1,
    )
    session.add(food)

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        logger.warning("Create food failed due to duplicate name=%s user_id=%s.", payload.name, user.id)
        raise FoodAlreadyExistsException() from exc

    await session.refresh(food)
    logger.info("Created food_id=%s user_id=%s status=%s.", food.id, user.id, food.status)
    await enqueue_food_embedding_jobs(session, redis, [food], trigger="create")
    await session.refresh(food)
    return food


async def update_food(
    session: AsyncSession,
    redis: Redis,
    user: User,
    food_id: UUID,
    payload: FoodUpdate,
) -> Food:
    food = await get_food_by_id(session, user.id, food_id)
    update_data = payload.model_dump(exclude_unset=True)
    embedding_source_changed = bool(_EMBEDDING_SOURCE_FIELDS.intersection(update_data))
    logger.info(
        "Updating food_id=%s user_id=%s changed_fields=%s embedding_source_changed=%s.",
        food_id,
        user.id,
        sorted(update_data.keys()),
        embedding_source_changed,
    )

    for field_name, value in update_data.items():
        setattr(food, field_name, value)

    if embedding_source_changed:
        _prepare_food_for_embedding_refresh(food)

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        logger.warning("Update food failed due to duplicate name food_id=%s user_id=%s.", food_id, user.id)
        raise FoodAlreadyExistsException() from exc

    await session.refresh(food)

    if embedding_source_changed:
        await enqueue_food_embedding_jobs(session, redis, [food], trigger="update")
        await session.refresh(food)

    return food


async def favorite_food(
    session: AsyncSession,
    user: User,
    food_id: UUID,
    *,
    is_favorite: bool,
) -> Food:
    food = await get_food_by_id(session, user.id, food_id)
    food.is_favorite = is_favorite
    await session.commit()
    await session.refresh(food)
    logger.info("Updated favorite state for food_id=%s user_id=%s is_favorite=%s.", food_id, user.id, is_favorite)
    return food


async def set_food_active_state(
    session: AsyncSession,
    user: User,
    food_id: UUID,
    *,
    is_active: bool,
) -> Food:
    food = await get_food_by_id(session, user.id, food_id)

    if food.status in {FoodStatusEnum.WAIT_FOR_PROCESS, FoodStatusEnum.PROCESSING}:
        logger.info(
            "Skipped active state change for food_id=%s user_id=%s because status=%s.",
            food_id,
            user.id,
            food.status,
        )
        return food

    if food.status == FoodStatusEnum.FAILED and is_active:
        logger.info(
            "Skipped activating failed food_id=%s user_id=%s until embedding is regenerated.",
            food_id,
            user.id,
        )
        return food

    food.status = FoodStatusEnum.ACTIVE if is_active else FoodStatusEnum.INACTIVE
    await session.commit()
    await session.refresh(food)
    logger.info("Set active state for food_id=%s user_id=%s status=%s.", food_id, user.id, food.status)
    return food


async def recycle_food(session: AsyncSession, user: User, food_id: UUID) -> Food:
    food = await get_food_by_id(session, user.id, food_id)
    food.is_recycled = True
    await session.commit()
    await session.refresh(food)
    logger.info("Recycled food_id=%s user_id=%s.", food_id, user.id)
    return food


async def restore_food(session: AsyncSession, user: User, food_id: UUID) -> Food:
    food = await get_food_by_id(session, user.id, food_id)
    food.is_recycled = False
    await session.commit()
    await session.refresh(food)
    logger.info("Restored food_id=%s user_id=%s.", food_id, user.id)
    return food


async def hard_delete_food(session: AsyncSession, user: User, food_id: UUID) -> None:
    food = await get_food_by_id(session, user.id, food_id)
    await session.delete(food)
    await session.commit()
    logger.info("Hard deleted food_id=%s user_id=%s.", food_id, user.id)
