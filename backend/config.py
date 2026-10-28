from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql://agent_reader:agent_local@127.0.0.1:5432/marketplace"
    admin_database_url: str = "postgresql://hack:hack@127.0.0.1:5432/marketplace"
    llm_base_url: str = "http://127.0.0.1:8091/v1"
    llm_api_key: str = "local"
    llm_model: str = "gpt-6.1-sol"
    polza_api_key: str = ""
    embedding_base_url: str = "https://polza.ai/api/v1"
    embedding_model: str = "qwen/qwen3-embedding-8b"
    embedding_dimensions: int = 4096
    sql_timeout_ms: int = 10000
    sql_row_limit: int = 500
    max_turns: int = 12
    run_timeout_seconds: int = 300
    gigaam_model_dir: Path = Path(".local/models/gigaam")
    gigaam_threads: int = 4
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]


@lru_cache
def settings() -> Settings:
    return Settings()
