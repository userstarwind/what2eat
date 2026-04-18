from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class FoodSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    embedding_dimensions: int = 1024
    use_cache: bool = True

    @property
    def default_food_path(self) -> Path:
        return Path(__file__).resolve().parent / "default_food.json"


food_settings = FoodSettings()
