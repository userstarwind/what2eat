from contextlib import asynccontextmanager
import logging
from logging.config import fileConfig
from multiprocessing import Process
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.auth.router import auth_router
from src.config import global_settings
from src.database import close_db, close_redis, init_db, init_redis
from src.food.emb import run_food_embedding_worker_process
from src.food.router import food_router
from src.food.service import ensure_default_food_cache
from src.recommand.router import recommendation_router



def setup_logging() -> Path:
    logging_config_path = Path(__file__).resolve().parents[1] / "logging.ini"
    if logging_config_path.exists():
        fileConfig(logging_config_path, disable_existing_loggers=False)
    return logging_config_path


LOGGING_CONFIG_PATH = setup_logging()
logger = logging.getLogger(__name__)


def start_food_embedding_processes() -> list[Process]:
    processes: list[Process] = []
    for index in range(global_settings.food_embedding_worker_processes):
        process = Process(
            target=run_food_embedding_worker_process,
            args=(index,),
            daemon=True,
        )
        process.start()
        processes.append(process)
    return processes


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Starting application and initializing database metadata.")
    await ensure_default_food_cache()
    await init_redis()
    await init_db()
    worker_processes = start_food_embedding_processes()
    try:
        yield
    finally:
        logger.info("Shutting down application and closing resources.")
        for process in worker_processes:
            if process.is_alive():
                process.terminate()
                process.join(timeout=5)
        await close_db()
        await close_redis()


app = FastAPI(
    title=global_settings.app_name,
    version=global_settings.app_version,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=global_settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(food_router)
app.include_router(recommendation_router)



@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    logger.debug("Health check endpoint hit.")
    return {"status": "ok"}

