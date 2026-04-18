from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .config import food_settings
from .enum import (
    ConvenienceEnum,
    CuisineEnum,
    FoodStatusEnum,
    MealTypeEnum,
    PriceRangeEnum,
)


class FoodBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)
    cuisine: CuisineEnum | None = None
    meal_type: MealTypeEnum | None = None
    price_range: PriceRangeEnum = PriceRangeEnum.MEDIUM
    convenience: ConvenienceEnum = ConvenienceEnum.MEDIUM

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Name cannot be empty.")
        return normalized

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class FoodCreate(FoodBase):
    pass


class FoodUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)
    cuisine: CuisineEnum | None = None
    meal_type: MealTypeEnum | None = None
    price_range: PriceRangeEnum | None = None
    convenience: ConvenienceEnum | None = None
    status: FoodStatusEnum | None = None

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("Name cannot be empty.")
        return normalized

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class FoodRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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


class DefaultFoodItem(FoodBase):
    embedding: list[float] | None = None
    status: FoodStatusEnum | None = None

    @field_validator("embedding")
    @classmethod
    def validate_embedding(cls, value: list[float] | None) -> list[float] | None:
        if value is None:
            return None
        if len(value) != food_settings.embedding_dimensions:
            raise ValueError(
                f"Embedding length must be {food_settings.embedding_dimensions}."
            )
        return value
