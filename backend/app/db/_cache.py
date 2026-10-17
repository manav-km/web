"""db/_cache.py — lightweight in-memory cache for public content queries."""
import time
from typing import Any


class TTLCache:
    def __init__(self, ttl_seconds: float = 60.0):
        self.ttl = ttl_seconds
        self._store: dict[str, tuple[float, Any]] = {}

    def get(self, key: str) -> Any | None:
        if key in self._store:
            ts, val = self._store[key]
            if time.time() - ts < self.ttl:
                return val
            del self._store[key]
        return None

    def set(self, key: str, val: Any) -> None:
        self._store[key] = (time.time(), val)

    def invalidate(self, key_prefix: str = "") -> None:
        if not key_prefix:
            self._store.clear()
        else:
            keys_to_del = [k for k in self._store if k.startswith(key_prefix)]
            for k in keys_to_del:
                del self._store[k]
