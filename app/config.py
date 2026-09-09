"""Application settings.

The timing floor lives here so the blend is configurable without touching
the scoring engine (spec section 7).
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = "sqlite:///./prospects.db"

    # Priority = Value × (floor + (1 − floor) × Timing / 100). A prospect
    # with nothing recent keeps `floor` of their value (app/scoring/engine.py).
    timing_floor: float = 0.60

    # Minimum identity-match score required to merge two raw records
    identity_match_threshold: float = 0.80


@lru_cache
def get_settings() -> Settings:
    return Settings()
