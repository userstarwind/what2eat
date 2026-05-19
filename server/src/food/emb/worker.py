import asyncio
import logging

from sqlalchemy import update
from sqlmodel import select

from src.config import global_settings
from src.database import (
    SessionLocal,
    close_db,
    close_redis,
    init_db,
    init_redis,
    redis_client,
)
from src.food.enum import FoodEmbeddingStatusEnum
from src.food.models import Food, utcnow

from .client import request_embeddings
from .queue import enqueue_food_embedding_job, parse_food_embedding_job

logger = logging.getLogger(__name__)


def _build_food_embedding_source(food: Food) -> str:
    return "\n".join(
        [
            f"name: {food.name}",
            f"description: {food.description or ''}",
            f"cuisine: {food.cuisine.value if food.cuisine else ''}",
            f"meal_type: {food.meal_type.value if food.meal_type else ''}",
            f"price_range: {food.price_range.value}",
            f"convenience: {food.convenience.value}",
        ]
    )


async def _ack_job(stream_id: str) -> None:
    await redis_client.xack(
        global_settings.food_embedding_stream_key,
        global_settings.food_embedding_consumer_group,
        stream_id,
    )


async def _read_jobs(consumer_name: str, pending_only: bool) -> list[dict[str, str | int]]:
    # First drain this consumer group's pending entries, then block for new work.
    # This lets a restarted worker recover jobs it read but did not finish.
    stream_position = "0" if pending_only else ">"
    response = await redis_client.xreadgroup(
        groupname=global_settings.food_embedding_consumer_group,
        consumername=consumer_name,
        streams={global_settings.food_embedding_stream_key: stream_position},
        count=global_settings.food_embedding_read_count,
        block=1 if pending_only else global_settings.food_embedding_block_ms,
    )

    jobs: list[dict[str, str | int]] = []
    for _, messages in response:
        for stream_id, payload in messages:
            try:
                jobs.append(parse_food_embedding_job(stream_id, payload))
            except (KeyError, ValueError) as exc:
                logger.warning("Dropping malformed embedding job %s: %s", stream_id, exc)
                await _ack_job(stream_id)
    if jobs:
        logger.info(
            "Worker %s read %s embedding jobs pending_only=%s.",
            consumer_name,
            len(jobs),
            pending_only,
        )
    return jobs


async def _set_processing_if_fresh(job: dict[str, str | int]) -> Food | None:
    food_id = job["food_id"]
    user_id = job["user_id"]
    version = job["version"]
    stream_id = str(job["stream_id"])

    async with SessionLocal() as session:
        result = await session.execute(
            select(Food).where(Food.id == food_id, Food.user_id == user_id)
        )
        food = result.scalar_one_or_none()
        # Version checks prevent a slow or retried job from embedding stale food
        # text after the user has edited the item.
        if food is None or food.version != version:
            logger.info(
                "Discarding stale or missing job stream_id=%s food_id=%s user_id=%s version=%s.",
                stream_id,
                food_id,
                user_id,
                version,
            )
            await _ack_job(stream_id)
            return None

        if (
            food.embedding is not None
            and food.embedding_status == FoodEmbeddingStatusEnum.READY
        ):
            logger.info(
                "Skipping already-embedded food for job stream_id=%s food_id=%s.",
                stream_id,
                food_id,
            )
            await _ack_job(stream_id)
            return None

        update_result = await session.execute(
            update(Food)
            .where(Food.id == food_id, Food.user_id == user_id, Food.version == version)
            .values(
                embedding_status=FoodEmbeddingStatusEnum.PROCESSING,
                updated_at=utcnow(),
            )
        )
        if update_result.rowcount == 0:
            await session.rollback()
            await _ack_job(stream_id)
            return None

        await session.commit()
        await session.refresh(food)
        logger.info(
            "Worker moved food_id=%s embedding_status to PROCESSING version=%s.",
            food_id,
            version,
        )
        return food


async def _handle_success(job: dict[str, str | int], embedding: list[float]) -> None:
    food_id = job["food_id"]
    user_id = job["user_id"]
    version = job["version"]
    stream_id = str(job["stream_id"])

    async with SessionLocal() as session:
        result = await session.execute(
            update(Food)
            .where(Food.id == food_id, Food.user_id == user_id, Food.version == version)
            .values(
                embedding=embedding,
                embedding_status=FoodEmbeddingStatusEnum.READY,
                updated_at=utcnow(),
            )
        )
        if result.rowcount == 0:
            logger.info("Discarded stale embedding result for food %s.", food_id)
        else:
            logger.info("Embedding job succeeded for food_id=%s version=%s.", food_id, version)
        await session.commit()

    await _ack_job(stream_id)


async def _handle_failure(job: dict[str, str | int], reason: Exception) -> None:
    food_id = job["food_id"]
    user_id = job["user_id"]
    version = job["version"]
    attempt = int(job["attempt"])
    trigger = str(job["trigger"])
    stream_id = str(job["stream_id"])

    logger.warning(
        "Embedding job failed for food %s on attempt %s: %s",
        food_id,
        attempt,
        reason,
    )

    async with SessionLocal() as session:
        # Put retryable jobs back into PENDING before re-enqueueing; otherwise
        # the UI would show PROCESSING until the next attempt finishes.
        if attempt + 1 >= global_settings.food_embedding_max_retries:
            await session.execute(
                update(Food)
                .where(Food.id == food_id, Food.user_id == user_id, Food.version == version)
                .values(
                    embedding_status=FoodEmbeddingStatusEnum.FAILED,
                    updated_at=utcnow(),
                )
            )
        else:
            await session.execute(
                update(Food)
                .where(Food.id == food_id, Food.user_id == user_id, Food.version == version)
                .values(
                    embedding_status=FoodEmbeddingStatusEnum.PENDING,
                    updated_at=utcnow(),
                )
            )
        await session.commit()

    await _ack_job(stream_id)

    if attempt + 1 < global_settings.food_embedding_max_retries:
        await enqueue_food_embedding_job(
            redis_client,
            food_id=food_id,
            user_id=user_id,
            version=version,
            trigger=trigger,
            attempt=attempt + 1,
        )


async def process_embedding_jobs_once(consumer_name: str) -> None:
    jobs = await _read_jobs(consumer_name, pending_only=True)
    if not jobs:
        jobs = await _read_jobs(consumer_name, pending_only=False)
    if not jobs:
        return

    ready_jobs: list[dict[str, str | int]] = []
    input_texts: list[str] = []

    for job in jobs:
        # Claim each job in the database before sending a batched embedding
        # request, so duplicate workers do not process the same fresh version.
        food = await _set_processing_if_fresh(job)
        if food is None:
            continue
        ready_jobs.append(job)
        input_texts.append(_build_food_embedding_source(food))

    if not ready_jobs:
        return

    logger.info(
        "Worker %s is processing %s embedding jobs in this batch.",
        consumer_name,
        len(ready_jobs),
    )

    try:
        embeddings = await request_embeddings(input_texts)
    except Exception as exc:
        for job in ready_jobs:
            await _handle_failure(job, exc)
        return

    for job, embedding in zip(ready_jobs, embeddings, strict=True):
        await _handle_success(job, embedding)


async def run_food_embedding_worker(consumer_name: str) -> None:
    logger.info("Starting food embedding worker consumer_name=%s.", consumer_name)
    await init_redis()
    await init_db()
    try:
        while True:
            await process_embedding_jobs_once(consumer_name)
    finally:
        logger.info("Stopping food embedding worker consumer_name=%s.", consumer_name)
        await close_db()
        await close_redis()


def run_food_embedding_worker_process(worker_index: int = 0) -> None:
    consumer_name = f"{global_settings.food_embedding_consumer_name}-{worker_index}"
    asyncio.run(run_food_embedding_worker(consumer_name))
