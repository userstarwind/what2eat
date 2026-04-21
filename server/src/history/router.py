import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.database import get_session

from .schemas import RecommendationHistoryListResponse, RecommendationHistoryRead
from .service import get_recommendation_history, list_recommendation_histories

recommendation_history_router = APIRouter(
    prefix="/recommendation-histories",
    tags=["recommendation-histories"],
)
logger = logging.getLogger(__name__)


@recommendation_history_router.get("", response_model=RecommendationHistoryListResponse)
async def list_recommendation_histories_endpoint(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RecommendationHistoryListResponse:
    logger.info(
        "Listing recommendation histories for user_id=%s offset=%s limit=%s.",
        current_user.id,
        offset,
        limit,
    )
    return await list_recommendation_histories(
        session,
        current_user.id,
        limit=limit,
        offset=offset,
    )


@recommendation_history_router.get("/{history_id}", response_model=RecommendationHistoryRead)
async def get_recommendation_history_endpoint(
    history_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RecommendationHistoryRead:
    logger.info(
        "Fetching recommendation history history_id=%s for user_id=%s.",
        history_id,
        current_user.id,
    )
    return await get_recommendation_history(session, current_user.id, history_id)
