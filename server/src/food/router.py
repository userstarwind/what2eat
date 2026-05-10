import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.database import get_redis, get_session

from .enum import (
    ConvenienceEnum,
    CuisineEnum,
    FoodEmbeddingStatusEnum,
    FoodStatusEnum,
    MealTypeEnum,
    PriceRangeEnum,
)
from .schemas import FoodCreate, FoodRead, FoodUpdate
from .service import (
    create_food,
    favorite_food,
    get_food_by_id,
    hard_delete_food,
    list_foods,
    recycle_food,
    restore_food,
    set_food_active_state,
    update_food,
)

food_router = APIRouter(prefix="/foods", tags=["foods"])
logger = logging.getLogger(__name__)


@food_router.get("", response_model=list[FoodRead])
async def get_foods(
    keyword: str | None = Query(default=None),
    favorites_only: bool = Query(default=False),
    include_recycled: bool = Query(default=False),
    recycled_only: bool = Query(default=False),
    cuisine: CuisineEnum | None = Query(default=None),
    meal_type: MealTypeEnum | None = Query(default=None),
    price_range: PriceRangeEnum | None = Query(default=None),
    convenience: ConvenienceEnum | None = Query(default=None),
    status_filter: FoodStatusEnum | None = Query(default=None, alias="status"),
    embedding_status_filter: FoodEmbeddingStatusEnum | None = Query(
        default=None,
        alias="embedding_status",
    ),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[FoodRead]:
    logger.info(
        "Listing foods for user_id=%s favorites_only=%s recycled_only=%s include_recycled=%s keyword=%s status=%s embedding_status=%s.",
        current_user.id,
        favorites_only,
        recycled_only,
        include_recycled,
        keyword,
        status_filter,
        embedding_status_filter,
    )
    foods = await list_foods(
        session,
        current_user.id,
        keyword=keyword,
        favorites_only=favorites_only,
        include_recycled=include_recycled,
        recycled_only=recycled_only,
        cuisine=cuisine,
        meal_type=meal_type,
        price_range=price_range,
        convenience=convenience,
        status=status_filter,
        embedding_status=embedding_status_filter,
    )
    logger.info("Listed %s foods for user_id=%s.", len(foods), current_user.id)
    return [FoodRead.model_validate(food) for food in foods]


@food_router.get("/{food_id}", response_model=FoodRead)
async def get_food(
    food_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> FoodRead:
    food = await get_food_by_id(session, current_user.id, food_id)
    logger.info("Fetched food_id=%s for user_id=%s.", food_id, current_user.id)
    return FoodRead.model_validate(food)


@food_router.post(
    "",
    response_model=FoodRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_food_endpoint(
    payload: FoodCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    redis: Redis = Depends(get_redis),
) -> FoodRead:
    logger.info("Creating food for user_id=%s name=%s.", current_user.id, payload.name)
    food = await create_food(session, redis, current_user, payload)
    logger.info("Created food_id=%s for user_id=%s.", food.id, current_user.id)
    return FoodRead.model_validate(food)


@food_router.patch("/{food_id}", response_model=FoodRead)
async def update_food_endpoint(
    food_id: UUID,
    payload: FoodUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    redis: Redis = Depends(get_redis),
) -> FoodRead:
    logger.info("Updating food_id=%s for user_id=%s.", food_id, current_user.id)
    food = await update_food(session, redis, current_user, food_id, payload)
    logger.info("Updated food_id=%s for user_id=%s status=%s.", food.id, current_user.id, food.status)
    return FoodRead.model_validate(food)


@food_router.post("/{food_id}/favorite", response_model=FoodRead)
async def favorite_food_endpoint(
    food_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> FoodRead:
    food = await favorite_food(session, current_user, food_id, is_favorite=True)
    logger.info("Marked food_id=%s favorite for user_id=%s.", food_id, current_user.id)
    return FoodRead.model_validate(food)


@food_router.delete("/{food_id}/favorite", response_model=FoodRead)
async def unfavorite_food_endpoint(
    food_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> FoodRead:
    food = await favorite_food(session, current_user, food_id, is_favorite=False)
    logger.info("Removed favorite from food_id=%s for user_id=%s.", food_id, current_user.id)
    return FoodRead.model_validate(food)


@food_router.post("/{food_id}/activate", response_model=FoodRead)
async def activate_food_endpoint(
    food_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> FoodRead:
    food = await set_food_active_state(session, current_user, food_id, is_active=True)
    logger.info("Activated food_id=%s for user_id=%s resulting_status=%s.", food_id, current_user.id, food.status)
    return FoodRead.model_validate(food)


@food_router.post("/{food_id}/deactivate", response_model=FoodRead)
async def deactivate_food_endpoint(
    food_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> FoodRead:
    food = await set_food_active_state(session, current_user, food_id, is_active=False)
    logger.info("Deactivated food_id=%s for user_id=%s resulting_status=%s.", food_id, current_user.id, food.status)
    return FoodRead.model_validate(food)


@food_router.delete("/{food_id}", response_model=FoodRead)
async def recycle_food_endpoint(
    food_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> FoodRead:
    food = await recycle_food(session, current_user, food_id)
    logger.info("Recycled food_id=%s for user_id=%s.", food_id, current_user.id)
    return FoodRead.model_validate(food)


@food_router.post("/{food_id}/recycle", response_model=FoodRead)
async def recycle_food_explicit_endpoint(
    food_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> FoodRead:
    food = await recycle_food(session, current_user, food_id)
    logger.info("Recycled food_id=%s for user_id=%s via explicit endpoint.", food_id, current_user.id)
    return FoodRead.model_validate(food)


@food_router.post("/{food_id}/restore", response_model=FoodRead)
async def restore_food_endpoint(
    food_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> FoodRead:
    food = await restore_food(session, current_user, food_id)
    logger.info("Restored food_id=%s for user_id=%s.", food_id, current_user.id)
    return FoodRead.model_validate(food)


@food_router.delete("/{food_id}/purge", status_code=status.HTTP_204_NO_CONTENT)
async def hard_delete_food_endpoint(
    food_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await hard_delete_food(session, current_user, food_id)
    logger.info("Permanently deleted food_id=%s for user_id=%s.", food_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
