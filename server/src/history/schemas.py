from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from src.food.enum import (
    ConvenienceEnum,
    CuisineEnum,
    FoodStatusEnum,
    MealTypeEnum,
    PriceRangeEnum,
)


class RecommendationPreferenceSnapshot(BaseModel):
    cuisine: list[CuisineEnum] = Field(default_factory=list)
    meal_type: list[MealTypeEnum] = Field(default_factory=list)
    price_range: list[PriceRangeEnum] = Field(default_factory=list)
    convenience: list[ConvenienceEnum] = Field(default_factory=list)
    only_from_favorite: bool = False
    extra_request: str | None = None
    exclude_food_ids: list[UUID] = Field(default_factory=list)


class RecommendationFoodSnapshot(BaseModel):
    id: UUID
    name: str
    description: str | None
    cuisine: CuisineEnum | None
    meal_type: MealTypeEnum | None
    price_range: PriceRangeEnum
    convenience: ConvenienceEnum
    status: FoodStatusEnum
    version: int
    is_favorite: bool
    is_recycled: bool
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class RecommendationHistoryItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    food_id: UUID | None
    rank: int
    coarse_rank: int
    coarse_distance: float
    rerank_score: float
    reason: str
    food_snapshot: RecommendationFoodSnapshot


class RecommendationHistorySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    preference_snapshot: RecommendationPreferenceSnapshot
    candidate_pool_size: int
    coarse_top_k: int
    final_top_k: int
    recommendation_count: int
    created_at: datetime


class RecommendationHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    preference_snapshot: RecommendationPreferenceSnapshot
    candidate_pool_size: int
    coarse_top_k: int
    final_top_k: int
    created_at: datetime
    recommendations: list[RecommendationHistoryItemRead]


class RecommendationHistoryListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[RecommendationHistorySummary]
