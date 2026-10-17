"""
services/github_sync.py — pulls repo metadata from GitHub for manav-km
and caches it into the `repositories` table. Called from:
  - a scheduled cron endpoint (api/v1/admin.py /cron/sync-github)
  - manually via the admin panel (POST /api/v1/repositories/admin/sync)
  - opportunistically on the public GET /api/v1/repositories if the DB is sparse
"""
import asyncio
import logging
from datetime import UTC, datetime

import httpx

from app.core.config import get_settings
from app.db import repositories as repo_db
from app.services.supabase_client import get_supabase

logger = logging.getLogger("github_sync")

_API = "https://api.github.com"
_CONNECT_TIMEOUT = 10.0
_READ_TIMEOUT = 20.0
_POOL_TIMEOUT = 60.0
_MAX_CONCURRENT_REQUESTS = 10


async def sync_all() -> dict:
    settings = get_settings()
    results = {"synced": [], "failed": []}

    timeout = httpx.Timeout(
        connect=_CONNECT_TIMEOUT,
        read=_READ_TIMEOUT,
        write=10.0,
        pool=_POOL_TIMEOUT,
    )

    limits = httpx.Limits(max_connections=20, max_keepalive_connections=10)

    async with httpx.AsyncClient(timeout=timeout, limits=limits) as client:
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

            # Fetch languages for all repos in parallel with bounded concurrency
            sem = asyncio.Semaphore(_MAX_CONCURRENT_REQUESTS)

            async def _process_repo(repo: dict, acc: str = account, s: asyncio.Semaphore = sem) -> tuple[dict, dict, bool]:
                repo_name = repo["name"]
                async with s:
                    try:
                        langs = await _fetch_languages(client, headers, acc, repo_name)
                        return repo, langs, True
                    except httpx.HTTPError as exc:
                        logger.warning("Language fetch failed for %s/%s: %s", acc, repo_name, exc)
                        return repo, {}, False

            repo_tasks = [_process_repo(r) for r in repos]
            processed = await asyncio.gather(*repo_tasks)

            # Build batch records
            now_iso = datetime.now(UTC).isoformat()
            batch_records = []
            for repo, langs, ok in processed:
                languages_list = [
                    {"name": name, "percent": pct}
                    for name, pct in sorted(langs.items(), key=lambda kv: -kv[1])
                ]
                record = {
                    "source": account,
                    "repo_name": repo["name"],
                    "description": repo.get("description"),
                    "github_url": repo["html_url"],
                    "languages": languages_list,
                    "stars": repo.get("stargazers_count", 0),
                    "forks": repo.get("forks_count", 0),
                    "github_updated_at": repo.get("updated_at"),
                    "last_synced_at": now_iso,
                }
                batch_records.append((record, ok))

            # Batch upsert to Supabase in one roundtrip
            sb = get_supabase()
            try:
                records_data = [r[0] for r in batch_records]
                if records_data:
                    sb.table("repositories").upsert(
                        records_data,
                        on_conflict="source,repo_name",
                    ).execute()
                    for r, ok in batch_records:
                        suffix = "" if ok else " (no languages)"
                        results["synced"].append(f"{account}/{r['repo_name']}{suffix}")
            except Exception as exc:  # noqa: BLE001
                logger.warning("Batch upsert failed (%s), falling back to single upserts: %s", account, exc)
                for r, ok in batch_records:
                    try:
                        sb.table("repositories").upsert(r, on_conflict="source,repo_name").execute()
                        suffix = "" if ok else " (no languages)"
                        results["synced"].append(f"{account}/{r['repo_name']}{suffix}")
                    except Exception as inner_exc:  # noqa: BLE001
                        logger.error("Upsert failed for %s/%s: %s", account, r["repo_name"], inner_exc)
                        results["failed"].append(f"{account}/{r['repo_name']}")

    repo_db.invalidate_cache()
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
