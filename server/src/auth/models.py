from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True, nullable=False)
    email: str = Field(index=True, unique=True, max_length=255, nullable=False)
    full_name: str | None = Field(default=None, max_length=120)
    hashed_password: str | None = Field(default=None, max_length=255, nullable=True)

