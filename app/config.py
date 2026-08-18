"""Application settings.

Scoring weights live here so the ranking formula is configurable without
touching the scoring engine (spec section 7).
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = "sqlite:///./prospects.db"

    # Final ranking formula: total = qual * w_q + timing * w_t
    qualification_weight: float = 0.60
    timing_weight: float = 0.40

    # Minimum identity-match score required to merge two raw records
    identity_match_threshold: float = 0.80


@lru_cache
def get_settings() -> Settings:
    return Settings()
