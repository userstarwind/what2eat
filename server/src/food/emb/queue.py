from uuid import UUID

from redis.asyncio import Redis
from redis.exceptions import ResponseError

from src.config import global_settings


async def ensure_food_embedding_stream_group(redis: Redis) -> None:
    try:
        await redis.xgroup_create(
            global_settings.food_embedding_stream_key,
            global_settings.food_embedding_consumer_group,
            id="0",
            mkstream=True,
        )
    except ResponseError as exc:
        if "BUSYGROUP" not in str(exc):
            raise


async def enqueue_food_embedding_job(
    redis: Redis,
    *,
    food_id: UUID,
    user_id: UUID,
    version: int,
    trigger: str,
    attempt: int = 0,
) -> str:
    return await redis.xadd(
        global_settings.food_embedding_stream_key,
        {
            "food_id": str(food_id),
            "user_id": str(user_id),
            "version": str(version),
            "attempt": str(attempt),
            "trigger": trigger,
        },
        maxlen=global_settings.food_embedding_stream_maxlen,
        approximate=True,
    )


async def enqueue_food_embedding_jobs_batch(
    redis: Redis,
    jobs: list[dict[str, str]],
) -> list[str]:
    if not jobs:
        return []

    async with redis.pipeline(transaction=False) as pipeline:
        for job in jobs:
            pipeline.xadd(
                global_settings.food_embedding_stream_key,
                job,
                maxlen=global_settings.food_embedding_stream_maxlen,
                approximate=True,
            )
        results = await pipeline.execute()

    return [str(result) for result in results]


def parse_food_embedding_job(stream_id: str, payload: dict[str, str]) -> dict[str, str | int | UUID]:
    return {
        "stream_id": stream_id,
        "food_id": UUID(payload["food_id"]),
        "user_id": UUID(payload["user_id"]),
        "version": int(payload["version"]),
        "attempt": int(payload.get("attempt", "0")),
        "trigger": payload.get("trigger", "unknown"),
    }
