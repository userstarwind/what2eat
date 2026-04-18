import logging

from fastapi import APIRouter, Depends, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_redis, get_session

from .schemas import AccessTokenResponse, LoginRequest, RegisterRequest
from .service import authenticate_user, build_access_token_response, register_user

auth_router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


@auth_router.post(
    "/register",
    response_model=AccessTokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    payload: RegisterRequest,
    session: AsyncSession = Depends(get_session),
    redis: Redis = Depends(get_redis),
) -> AccessTokenResponse:
    logger.info("Received register request for email=%s.", payload.email.strip().lower())
    user = await register_user(session, redis, payload)
    logger.info("Register request completed for user_id=%s.", user.id)
    return build_access_token_response(user)


@auth_router.post("/login", response_model=AccessTokenResponse)
async def login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_session),
) -> AccessTokenResponse:
    logger.info("Received login request for email=%s.", payload.email.strip().lower())
    user = await authenticate_user(session, payload)
    logger.info("Login request completed for user_id=%s.", user.id)
    return build_access_token_response(user)
