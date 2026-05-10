from datetime import datetime, timezone
from uuid import UUID, uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import Column, UniqueConstraint
from sqlmodel import Field, SQLModel

from .config import food_settings
from .enum import (
    ConvenienceEnum,
    CuisineEnum,
    FoodEmbeddingStatusEnum,
    FoodStatusEnum,
    MealTypeEnum,
    PriceRangeEnum,
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Food(SQLModel, table=True):
    __tablename__ = "foods"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_food_user_name"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True, nullable=False)
    name: str = Field(index=True, max_length=255, nullable=False)
    description: str | None = Field(default=None, max_length=255)

    cuisine: CuisineEnum | None = Field(default=None, nullable=True, index=True)
    meal_type: MealTypeEnum | None = Field(default=None, nullable=True, index=True)
    price_range: PriceRangeEnum = Field(default=PriceRangeEnum.MEDIUM, nullable=False)
    convenience: ConvenienceEnum = Field(default=ConvenienceEnum.MEDIUM, nullable=False)

    status: FoodStatusEnum = Field(default=FoodStatusEnum.ACTIVE, nullable=False)
    embedding_status: FoodEmbeddingStatusEnum = Field(
        default=FoodEmbeddingStatusEnum.UNAVAILABLE,
        nullable=False,
        index=True,
    )
    version: int = Field(default=1, nullable=False)
    is_favorite: bool = Field(default=False, nullable=False)
    is_recycled: bool = Field(default=False, nullable=False)
    embedding: list[float] | None = Field(
        default=None,
        sa_column=Column(Vector(food_settings.embedding_dimensions), nullable=True),
    )
    user_id: UUID = Field(default=None, foreign_key="users.id", nullable=False)

    created_at: datetime = Field(default_factory=utcnow, nullable=False)
    updated_at: datetime = Field(
        default_factory=utcnow,
        nullable=False,
        sa_column_kwargs={"onupdate": utcnow},
    )
