"""
services/github_sync.py — pulls repo metadata from GitHub for both accounts
and caches it into the `repositories` table. Called from a scheduled
cron endpoint (see api/v1/admin.py's /sync-github route) or manually by an
admin — never on the public request path.
"""
import logging
from datetime import datetime, timezone

import httpx

from app.core.config import get_settings
from app.services.supabase_client import get_supabase

logger = logging.getLogger("github_sync")

_API = "https://api.github.com"


async def sync_all() -> dict:
    settings = get_settings()
    results = {"synced": [], "failed": []}

    async with httpx.AsyncClient(timeout=15.0) as client:
        headers = {"Accept": "application/vnd.github+json"}
        if settings.github_token:
            headers["Authorization"] = f"Bearer {settings.github_token}"

        for account in settings.github_account_list:
            try:
                repos = await _fetch_account_repos(client, headers, account)
            except httpx.HTTPError as exc:
                logger.warning("GitHub sync failed for %s: %s", account, exc)
                results["failed"].append(account)
                continue

            for repo in repos:
                try:
                    languages = await _fetch_languages(client, headers, account, repo["name"])
                    _upsert_repository(account, repo, languages)
                    results["synced"].append(f"{account}/{repo['name']}")
                except httpx.HTTPError as exc:
                    logger.warning("Language fetch failed for %s/%s: %s", account, repo["name"], exc)
                    # Repo metadata still gets saved without languages rather
                    # than dropping the whole repo (§49 — degrade gracefully).
                    _upsert_repository(account, repo, {})
                    results["synced"].append(f"{account}/{repo['name']} (no languages)")

    return results


async def _fetch_account_repos(client: httpx.AsyncClient, headers: dict, account: str) -> list[dict]:
    resp = await client.get(f"{_API}/users/{account}/repos", headers=headers, params={"per_page": 100})
    resp.raise_for_status()
    return [r for r in resp.json() if not r.get("private")]


async def _fetch_languages(client: httpx.AsyncClient, headers: dict, account: str, repo_name: str) -> dict:
    resp = await client.get(f"{_API}/repos/{account}/{repo_name}/languages", headers=headers)
    resp.raise_for_status()
    raw = resp.json()  # {"JavaScript": 12345, "CSS": 3456, ...} in bytes
    total = sum(raw.values()) or 1
    return {lang: round(bytes_ * 100 / total) for lang, bytes_ in raw.items()}


def _upsert_repository(account: str, repo: dict, languages: dict) -> None:
    sb = get_supabase()
    languages_list = [{"name": name, "percent": pct} for name, pct in sorted(languages.items(), key=lambda kv: -kv[1])]

    sb.table("repositories").upsert(
        {
            "source": account,
            "repo_name": repo["name"],
            "description": repo.get("description"),
            "github_url": repo["html_url"],
            "languages": languages_list,
            "stars": repo.get("stargazers_count", 0),
            "forks": repo.get("forks_count", 0),
            "github_updated_at": repo.get("updated_at"),
            "last_synced_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="source,repo_name",
    ).execute()
