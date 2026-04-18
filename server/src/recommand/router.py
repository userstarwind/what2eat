import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.database import get_session

from .schemas import PreferenceFood, RecommendationResponse
from .service import recommend_foods

recommendation_router = APIRouter(prefix="/recommendations", tags=["recommendations"])
logger = logging.getLogger(__name__)


@recommendation_router.post("", response_model=RecommendationResponse)
async def recommend_foods_endpoint(
    payload: PreferenceFood,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RecommendationResponse:
    logger.info(
        "Received recommendation request user_id=%s only_from_favorite=%s cuisine=%s meal_type=%s.",
        current_user.id,
        payload.only_from_favorite,
        payload.cuisine,
        payload.meal_type,
    )
    response = await recommend_foods(session, current_user, payload)
    logger.info(
        "Recommendation request completed user_id=%s candidate_pool_size=%s final_top_k=%s.",
        current_user.id,
        response.candidate_pool_size,
        len(response.recommendations),
    )
    return response
