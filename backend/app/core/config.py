"""
core/config.py — one Settings object, built once, imported everywhere.
Never read os.environ directly elsewhere in the app; go through `settings`
so every required variable is validated at startup instead of failing
halfway through a request.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Firebase
    firebase_project_id: str
    firebase_service_account_json: str  # path to the service account JSON, or the JSON itself
    firebase_database_url: str | None = None  # set after enabling Realtime Database in the Firebase console

    # Supabase
    supabase_url: str
    supabase_service_role_key: str  # backend only — bypasses RLS by design

    # AI (Gemini or OpenRouter)
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.1-flash-lite"
    openrouter_api_key: str | None = None
    openrouter_model: str = "meta-llama/llama-3.1-8b-instruct:free"

    # GitHub
    github_token: str | None = None
    github_accounts: str = "manav-km"

    # Admin
    admin_firebase_uid: str | None = None

    # Security
    security_rate_limit_window_seconds: int = 60
    security_rate_limit_max_requests: int = 20
    security_block_duration_seconds: int = 900

    # Cron shared secret (protects /admin/cron/* endpoints called by Cloud Scheduler)
    cron_secret: str | None = None

    # Cloudflare Turnstile (bot protection on the Connect form, §40)
    turnstile_secret_key: str | None = None

    # CORS
    frontend_origin: str = "https://manavkm.web.app,https://manav-km.github.io,http://localhost:5000,http://localhost:3000,http://127.0.0.1:5500"

    # HTTPS enforcement (§5a) — set ENFORCE_HTTPS=true in production
    enforce_https: bool = False

    # IP privacy (§6a) — set IP_HASH_SALT env var in production
    ip_hash_salt: str = ""  # set IP_HASH_SALT env var in production
    ip_retention_days: int = 90  # set IP_RETENTION_DAYS env var

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origin.split(",") if o.strip()]

    @property
    def github_account_list(self) -> list[str]:
        return [a.strip() for a in self.github_accounts.split(",") if a.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  — populated from env at runtime
