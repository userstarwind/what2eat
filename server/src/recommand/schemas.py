from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator

from src.food.schemas import FoodRead

from src.food.enum import CuisineEnum, ConvenienceEnum, MealTypeEnum, PriceRangeEnum


class PreferenceFood(BaseModel):
    cuisine: list[CuisineEnum] = Field(default_factory=list)
    meal_type: list[MealTypeEnum] = Field(default_factory=list)
    price_range: list[PriceRangeEnum] = Field(default_factory=list)
    convenience: list[ConvenienceEnum] = Field(default_factory=list)
    only_from_favorite: bool = False
    extra_request: str | None = Field(default=None, max_length=500)
    exclude_food_ids: list[UUID] = Field(default_factory=list)

    @field_validator("cuisine", "meal_type", "price_range", "convenience")
    @classmethod
    def normalize_enum_lists(cls, value: list) -> list:
        return list(dict.fromkeys(value))

    @field_validator("cuisine", "meal_type", "price_range", "convenience")
    @classmethod
    def require_non_empty_enum_lists(cls, value: list, info: ValidationInfo) -> list:
        if not value:
            field_name = info.field_name.replace("_", " ")
            raise ValueError(f"{field_name} must include at least one selection.")
        return value

    @field_validator("exclude_food_ids")
    @classmethod
    def normalize_excluded_food_ids(cls, value: list[UUID]) -> list[UUID]:
        return list(dict.fromkeys(value))

    @field_validator("extra_request")
    @classmethod
    def normalize_extra_request(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class RecommendationItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    food: FoodRead
    coarse_rank: int
    coarse_distance: float
    rerank_score: float
    reason: str


class RecommendationResponse(BaseModel):
    candidate_pool_size: int
    coarse_top_k: int
    final_top_k: int
    recommendations: list[RecommendationItem]
