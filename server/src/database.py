from collections.abc import AsyncGenerator
import logging

from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from src.config import global_settings

logger = logging.getLogger(__name__)

engine: AsyncEngine = create_async_engine(
    global_settings.database_url,
    echo=global_settings.echo_sql,
    pool_pre_ping=True,
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

redis_client: Redis = Redis.from_url(
    global_settings.redis_url,
    decode_responses=True,
    socket_connect_timeout=global_settings.redis_socket_timeout_seconds,
    socket_timeout=global_settings.redis_command_socket_timeout_seconds,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def get_redis() -> AsyncGenerator[Redis, None]:
    yield redis_client


async def ensure_database_exists() -> None:
    maintenance_engine = create_async_engine(
        global_settings.maintenance_database_url,
        echo=global_settings.echo_sql,
        pool_pre_ping=True,
        isolation_level="AUTOCOMMIT",
    )

    try:
        async with maintenance_engine.connect() as conn:
            result = await conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :db_name"),
                {"db_name": global_settings.db_name},
            )
            exists = result.scalar() is not None
            if exists:
                logger.info("Database '%s' already exists.", global_settings.db_name)
                return

            logger.info("Database '%s' not found. Creating it now.", global_settings.db_name)
            quoted_db_name = _quote_postgres_identifier(global_settings.db_name)
            await conn.execute(text(f"CREATE DATABASE {quoted_db_name}"))
            logger.info("Database '%s' created successfully.", global_settings.db_name)
    finally:
        await maintenance_engine.dispose()


def _quote_postgres_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


async def init_redis() -> None:
    logger.info("Initializing redis connection.")
    await redis_client.ping()
    from src.food.emb.queue import ensure_food_embedding_stream_group

    await ensure_food_embedding_stream_group(redis_client)
    logger.info("Redis connection initialized.")


async def init_db() -> None:
    # Ensure SQLModel metadata includes all table models before create_all.
    from src.auth.models import User as _User  # noqa: F401
    from src.food.models import Food as _Food  # noqa: F401
    from src.history.models import RecommendationHistory as _RecommendationHistory  # noqa: F401
    from src.history.models import RecommendationHistoryItem as _RecommendationHistoryItem  # noqa: F401


    await ensure_database_exists()

    logger.info("Initializing database schema.")
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(SQLModel.metadata.create_all)
    logger.info("Database schema initialization completed.")


async def close_db() -> None:
    logger.info("Disposing database engine.")
    await engine.dispose()


async def close_redis() -> None:
    logger.info("Closing redis connection.")
    await redis_client.aclose()
