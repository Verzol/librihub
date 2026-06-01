from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    app_name: str = "LibriHub"
    app_version: str = "0.1.0"
    api_v1_prefix: str = "/api/v1"

    database_url: str = "postgresql+psycopg://librihub:librihub_password@localhost:5432/librihub"

    minio_endpoint: str = "http://localhost:9000"
    minio_public_endpoint: str = "http://localhost:9000"
    minio_bucket_book_covers: str = "book-covers"
    minio_root_user: str = Field(default="librihub_minio", repr=False)
    minio_root_password: str = Field(default="librihub_minio_password", repr=False)

    jwt_secret_key: str = Field(default="change-me-in-local-env", repr=False)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
