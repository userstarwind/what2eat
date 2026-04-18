import logging

from sqlalchemy.exc import IntegrityError
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from .config import auth_settings
from .dependencies import create_access_token, hash_password, verify_password
from .exceptions import EmailAlreadyExistsException, InvalidCredentialsException
from .models import User
from .schemas import AccessTokenResponse, LoginRequest, RegisterRequest, UserRead
from src.food.service import enqueue_food_embedding_jobs, seed_default_foods_for_user

logger = logging.getLogger(__name__)


def normalize_email(email: str) -> str:
    return email.strip().lower()


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    statement = select(User).where(User.email == normalize_email(email))
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def register_user(
    session: AsyncSession,
    redis: Redis,
    payload: RegisterRequest,
) -> User:
    normalized_email = normalize_email(payload.email)
    logger.info("Registering user email=%s.", normalized_email)
    existing_user = await get_user_by_email(session, payload.email)
    if existing_user is not None:
        logger.warning("Registration rejected because email already exists: %s.", normalized_email)
        raise EmailAlreadyExistsException()

    user = User(
        email=normalized_email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
    )
    session.add(user)

    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        logger.warning("Registration flush failed due to duplicate email=%s.", normalized_email)
        raise EmailAlreadyExistsException() from exc

    try:
        default_foods = await seed_default_foods_for_user(session, user)
        logger.info(
            "Seeded %s default foods for user_id=%s before commit.",
            len(default_foods),
            user.id,
        )
        await session.commit()
    except Exception:
        await session.rollback()
        logger.exception("Registration transaction failed for email=%s.", normalized_email)
        raise

    await enqueue_food_embedding_jobs(
        session,
        redis,
        default_foods,
        trigger="register",
    )

    await session.refresh(user)
    logger.info("User registration completed user_id=%s email=%s.", user.id, normalized_email)
    return user


async def authenticate_user(session: AsyncSession, payload: LoginRequest) -> User:
    normalized_email = normalize_email(payload.email)
    user = await get_user_by_email(session, payload.email)
    if user is None or not user.hashed_password:
        logger.warning("Login failed for email=%s: user not found or password unavailable.", normalized_email)
        raise InvalidCredentialsException()

    if not verify_password(payload.password, user.hashed_password):
        logger.warning("Login failed for email=%s: invalid password.", normalized_email)
        raise InvalidCredentialsException()

    logger.info("Authenticated user_id=%s email=%s.", user.id, normalized_email)
    return user


def build_access_token_response(user: User) -> AccessTokenResponse:
    access_token = create_access_token(subject=str(user.id))
    logger.info("Built access token response for user_id=%s.", user.id)
    return AccessTokenResponse(
        access_token=access_token,
        expires_in=auth_settings.access_token_expire_minutes * 60,
        user=UserRead.model_validate(user),
    )
