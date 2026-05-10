from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column, UniqueConstraint
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class RecommendationHistory(SQLModel, table=True):
    __tablename__ = "recommendation_histories"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True, nullable=False)
    user_id: UUID = Field(foreign_key="users.id", index=True, nullable=False)
    preference_snapshot: dict[str, object] = Field(
        sa_column=Column(JSON, nullable=False),
    )
    diagnostics_snapshot: dict[str, object] | None = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
    )
    candidate_pool_size: int = Field(nullable=False)
    coarse_top_k: int = Field(nullable=False)
    final_top_k: int = Field(nullable=False)
    created_at: datetime = Field(default_factory=utcnow, nullable=False)


class RecommendationHistoryItem(SQLModel, table=True):
    __tablename__ = "recommendation_history_items"
    __table_args__ = (
        UniqueConstraint(
            "history_id",
            "rank",
            name="uq_recommendation_history_item_history_rank",
        ),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True, nullable=False)
    history_id: UUID = Field(
        foreign_key="recommendation_histories.id",
        index=True,
        nullable=False,
    )
    food_id: UUID | None = Field(default=None, index=True, nullable=True)
    rank: int = Field(nullable=False)
    coarse_rank: int = Field(nullable=False)
    coarse_distance: float = Field(nullable=False)
    rerank_score: float = Field(nullable=False)
    reason: str = Field(max_length=1000, nullable=False)
    food_snapshot: dict[str, object] = Field(
        sa_column=Column(JSON, nullable=False),
    )
