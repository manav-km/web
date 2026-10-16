"""
services/github_sync.py — pulls repo metadata from GitHub for manav-km
and caches it into the `repositories` table. Called from:
  - a scheduled cron endpoint (api/v1/admin.py /cron/sync-github)
  - manually via the admin panel (POST /api/v1/repositories/admin/sync)
  - opportunistically on the public GET /api/v1/repositories if the DB is sparse
"""
import logging
from datetime import datetime, timezone

import httpx

from app.core.config import get_settings
from app.services.supabase_client import get_supabase

logger = logging.getLogger("github_sync")

_API = "https://api.github.com"

# Generous timeout: Render free dyno can be slow to wake, and we may be
# making up to 32 API calls (16 repos × list + languages). Give each
# call 30 s and the whole operation 120 s so a cold-start doesn't time out.
_CONNECT_TIMEOUT = 10.0
_READ_TIMEOUT    = 30.0
_POOL_TIMEOUT    = 120.0


async def sync_all() -> dict:
    settings = get_settings()
    results = {"synced": [], "failed": []}

    timeout = httpx.Timeout(
        connect=_CONNECT_TIMEOUT,
        read=_READ_TIMEOUT,
        write=10.0,
        pool=_POOL_TIMEOUT,
    )

    async with httpx.AsyncClient(timeout=timeout) as client:
        headers = {"Accept": "application/vnd.github+json"}
        if settings.github_token:
            headers["Authorization"] = f"Bearer {settings.github_token}"

        for account in settings.github_account_list:
            try:
                repos = await _fetch_account_repos(client, headers, account)
                logger.info("GitHub sync: fetched %d repos for %s", len(repos), account)
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
                except Exception as exc:  # noqa: BLE001
                    logger.error("Upsert failed for %s/%s: %s", account, repo["name"], exc)
                    results["failed"].append(f"{account}/{repo['name']}")

    logger.info("GitHub sync complete — synced: %d, failed: %d", len(results["synced"]), len(results["failed"]))
    return results


async def _fetch_account_repos(client: httpx.AsyncClient, headers: dict, account: str) -> list[dict]:
    resp = await client.get(f"{_API}/users/{account}/repos", headers=headers, params={"per_page": 100, "sort": "updated"})
    resp.raise_for_status()
    return [
        r for r in resp.json()
        if not r.get("private")
        and not r.get("fork")
        and "trd-dnmx" not in r.get("name", "").lower()
    ]


async def _fetch_languages(client: httpx.AsyncClient, headers: dict, account: str, repo_name: str) -> dict:
    resp = await client.get(f"{_API}/repos/{account}/{repo_name}/languages", headers=headers)
    resp.raise_for_status()
    raw = resp.json()  # {"JavaScript": 12345, "CSS": 3456, ...} in bytes
    total = sum(raw.values()) or 1
    return {lang: round(bytes_ * 100 / total) for lang, bytes_ in raw.items()}


def _upsert_repository(account: str, repo: dict, languages: dict) -> None:
    sb = get_supabase()
    languages_list = [
        {"name": name, "percent": pct}
        for name, pct in sorted(languages.items(), key=lambda kv: -kv[1])
    ]

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
