from pydantic_settings import BaseSettings, SettingsConfigDict
from urllib.parse import quote_plus


class GlobalSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "what2eat-server"
    app_version: str = "0.1.0"
    host: str = "0.0.0.0"
    port: int = 8080
    reload: bool = True
    cors_allowed_origins: str = "http://localhost:5173"

    db_scheme: str = "postgresql+asyncpg"
    db_host: str = "127.0.0.1"
    db_port: int = 5432
    db_user: str = "postgres"
    db_password: str = "surf"
    db_name: str = "what2eat"
    db_maintenance_db: str = "postgres"
    echo_sql: bool = False

    redis_host: str = "127.0.0.1"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: str | None = None
    redis_socket_timeout_seconds: int = 5
    food_embedding_stream_key: str = "stream:food_embedding_jobs"
    food_embedding_consumer_group: str = "food-embedding-workers"
    food_embedding_consumer_name: str = "food-embedding-worker-1"
    food_embedding_worker_processes: int = 1
    food_embedding_read_count: int = 32
    food_embedding_block_ms: int = 5000
    food_embedding_stream_maxlen: int = 10000
    food_embedding_max_retries: int = 3

    embedding_endpoint: str | None = None
    embedding_model: str | None = None
    embedding_query_instruction: str | None = None
    embedding_encoding_format: str = "float"
    embedding_timeout_seconds: int = 30
    rerank_endpoint: str | None = None
    rerank_model: str | None = None
    rerank_instruction: str | None = None
    rerank_timeout_seconds: int = 30
    chat_endpoint: str | None = None
    chat_model: str | None = None
    chat_max_tokens: int = 512
    chat_timeout_seconds: int = 30
    model_api_key: str | None = None
    embedding_api_key: str | None = None
    rerank_api_key: str | None = None
    chat_api_key: str | None = None
    model_api_key_header: str = "Authorization"
    model_api_key_scheme: str = "Bearer"

    recommendation_candidate_pool_minimum: int = 30
    recommendation_coarse_top_k: int = 10
    recommendation_final_top_k: int = 3

    repo_worker_processes: int = 1
    repo_clone_worker_processes: int | None = None
    repo_update_worker_processes: int | None = None

    def _build_model_request_headers(
        self,
        service_api_key: str | None = None,
    ) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        api_key = self.model_api_key if service_api_key is None else service_api_key
        if api_key:
            api_key = api_key.strip()
            scheme = self.model_api_key_scheme.strip()
            value = f"{scheme} {api_key}".strip() if scheme else api_key
            headers[self.model_api_key_header] = value
        return headers

    @property
    def model_request_headers(self) -> dict[str, str]:
        return self._build_model_request_headers()

    @property
    def embedding_request_headers(self) -> dict[str, str]:
        return self._build_model_request_headers(self.embedding_api_key)

    @property
    def rerank_request_headers(self) -> dict[str, str]:
        return self._build_model_request_headers(self.rerank_api_key)

    @property
    def chat_request_headers(self) -> dict[str, str]:
        return self._build_model_request_headers(self.chat_api_key)

    @property
    def database_url(self) -> str:
        encoded_password = quote_plus(self.db_password)
        return (
            f"{self.db_scheme}://{self.db_user}:{encoded_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def maintenance_database_url(self) -> str:
        encoded_password = quote_plus(self.db_password)
        return (
            f"{self.db_scheme}://{self.db_user}:{encoded_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_maintenance_db}"
        )

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_allowed_origins.split(",")
            if origin.strip()
        ]

    @property
    def redis_url(self) -> str:
        auth = ""
        if self.redis_password:
            auth = f":{quote_plus(self.redis_password)}@"
        return f"redis://{auth}{self.redis_host}:{self.redis_port}/{self.redis_db}"

    @property
    def redis_command_socket_timeout_seconds(self) -> float:
        # Stream blocking reads must have a socket timeout comfortably above BLOCK.
        block_timeout_seconds = (self.food_embedding_block_ms / 1000) + 2
        return max(float(self.redis_socket_timeout_seconds), block_timeout_seconds)


global_settings = GlobalSettings()
