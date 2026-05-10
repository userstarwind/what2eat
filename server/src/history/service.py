import logging
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.models import User
from src.recommand.schemas import PreferenceFood, RecommendationResponse

from .exceptions import RecommendationHistoryNotFoundException
from .models import RecommendationHistory, RecommendationHistoryItem
from .schemas import (
    RecommendationHistoryItemRead,
    RecommendationHistoryListResponse,
    RecommendationHistoryRead,
    RecommendationHistorySummary,
)

logger = logging.getLogger(__name__)


async def create_recommendation_history(
    session: AsyncSession,
    user: User,
    preference: PreferenceFood,
    response: RecommendationResponse,
) -> RecommendationHistory:
    history = RecommendationHistory(
        user_id=user.id,
        preference_snapshot=preference.model_dump(mode="json", exclude_none=True),
        diagnostics_snapshot=response.diagnostics.model_dump(mode="json"),
        candidate_pool_size=response.candidate_pool_size,
        coarse_top_k=response.coarse_top_k,
        final_top_k=response.final_top_k,
    )
    session.add(history)
    await session.flush()

    history_items = [
        RecommendationHistoryItem(
            history_id=history.id,
            food_id=item.food.id,
            rank=index,
            coarse_rank=item.coarse_rank,
            coarse_distance=item.coarse_distance,
            rerank_score=item.rerank_score,
            reason=item.reason,
            food_snapshot=item.food.model_dump(mode="json"),
        )
        for index, item in enumerate(response.recommendations, start=1)
    ]
    session.add_all(history_items)
    await session.commit()
    await session.refresh(history)
    logger.info(
        "Saved recommendation history history_id=%s user_id=%s recommendation_count=%s.",
        history.id,
        user.id,
        len(history_items),
    )
    return history


async def list_recommendation_histories(
    session: AsyncSession,
    user_id: UUID,
    *,
    limit: int,
    offset: int,
) -> RecommendationHistoryListResponse:
    total_result = await session.execute(
        select(func.count())
        .select_from(RecommendationHistory)
        .where(RecommendationHistory.user_id == user_id)
    )
    total = int(total_result.scalar_one() or 0)

    history_result = await session.execute(
        select(RecommendationHistory)
        .where(RecommendationHistory.user_id == user_id)
        .order_by(RecommendationHistory.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    histories = list(history_result.scalars().all())

    recommendation_count_by_history: dict[UUID, int] = {}
    history_ids = [history.id for history in histories]
    if history_ids:
        count_result = await session.execute(
            select(
                RecommendationHistoryItem.history_id,
                func.count().label("recommendation_count"),
            )
            .where(RecommendationHistoryItem.history_id.in_(history_ids))
            .group_by(RecommendationHistoryItem.history_id)
        )
        recommendation_count_by_history = {
            history_id: int(recommendation_count)
            for history_id, recommendation_count in count_result.all()
        }

    items = [
        RecommendationHistorySummary(
            id=history.id,
            preference_snapshot=history.preference_snapshot,
            diagnostics_snapshot=history.diagnostics_snapshot,
            candidate_pool_size=history.candidate_pool_size,
            coarse_top_k=history.coarse_top_k,
            final_top_k=history.final_top_k,
            recommendation_count=recommendation_count_by_history.get(history.id, 0),
            created_at=history.created_at,
        )
        for history in histories
    ]
    logger.info(
        "Listed %s recommendation histories for user_id=%s total=%s offset=%s limit=%s.",
        len(items),
        user_id,
        total,
        offset,
        limit,
    )
    return RecommendationHistoryListResponse(
        total=total,
        limit=limit,
        offset=offset,
        items=items,
    )


async def get_recommendation_history(
    session: AsyncSession,
    user_id: UUID,
    history_id: UUID,
) -> RecommendationHistoryRead:
    history_result = await session.execute(
        select(RecommendationHistory).where(
            RecommendationHistory.id == history_id,
            RecommendationHistory.user_id == user_id,
        )
    )
    history = history_result.scalar_one_or_none()
    if history is None:
        logger.warning(
            "Recommendation history not found history_id=%s user_id=%s.",
            history_id,
            user_id,
        )
        raise RecommendationHistoryNotFoundException()

    item_result = await session.execute(
        select(RecommendationHistoryItem)
        .where(RecommendationHistoryItem.history_id == history_id)
        .order_by(RecommendationHistoryItem.rank.asc())
    )
    history_items = list(item_result.scalars().all())

    recommendations = [
        RecommendationHistoryItemRead(
            id=item.id,
            food_id=item.food_id,
            rank=item.rank,
            coarse_rank=item.coarse_rank,
            coarse_distance=item.coarse_distance,
            rerank_score=item.rerank_score,
            reason=item.reason,
            food_snapshot=item.food_snapshot,
        )
        for item in history_items
    ]
    logger.info(
        "Fetched recommendation history history_id=%s user_id=%s recommendation_count=%s.",
        history_id,
        user_id,
        len(recommendations),
    )
    return RecommendationHistoryRead(
        id=history.id,
        preference_snapshot=history.preference_snapshot,
        diagnostics_snapshot=history.diagnostics_snapshot,
        candidate_pool_size=history.candidate_pool_size,
        coarse_top_k=history.coarse_top_k,
        final_top_k=history.final_top_k,
        created_at=history.created_at,
        recommendations=recommendations,
    )
