"""Watchlist persistence service for user monitoring preferences."""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

WATCHLIST_TOPICS: tuple[str, ...] = (
    "Politics",
    "Geopolitics",
    "Economy",
    "Markets",
    "Conflict",
    "Energy",
    "Infrastructure",
)

DEFAULT_WATCHLIST: dict[str, list[str]] = {
    "countries": [],
    "topics": [],
    "keywords": [],
}


class WatchlistService:
    def __init__(self, storage_path: Path) -> None:
        self.storage_path = storage_path
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        self._state_lock = threading.Lock()
        self._watchlist = self._load_from_disk()

    def get_watchlist(self) -> dict[str, list[str]]:
        with self._state_lock:
            return _copy_watchlist(self._watchlist)

    def update_watchlist(self, payload: dict[str, Any]) -> dict[str, list[str]]:
        sanitized = _sanitize_watchlist(payload)
        with self._state_lock:
            self._watchlist = sanitized
            _write_watchlist_file(self.storage_path, sanitized)
            return _copy_watchlist(self._watchlist)

    def _load_from_disk(self) -> dict[str, list[str]]:
        if not self.storage_path.exists():
            default_value = _copy_watchlist(DEFAULT_WATCHLIST)
            _write_watchlist_file(self.storage_path, default_value)
            return default_value

        try:
            payload = json.loads(self.storage_path.read_text(encoding="utf-8"))
            return _sanitize_watchlist(payload)
        except Exception:
            fallback = _copy_watchlist(DEFAULT_WATCHLIST)
            _write_watchlist_file(self.storage_path, fallback)
            return fallback


def _sanitize_watchlist(payload: dict[str, Any]) -> dict[str, list[str]]:
    if not isinstance(payload, dict):
        return _copy_watchlist(DEFAULT_WATCHLIST)

    countries = _sanitize_string_list(payload.get("countries"), lowercase=False)
    topics = _sanitize_topics(payload.get("topics"))
    keywords = _sanitize_string_list(payload.get("keywords"), lowercase=True)

    return {
        "countries": countries,
        "topics": topics,
        "keywords": keywords,
    }


def _sanitize_string_list(values: Any, *, lowercase: bool) -> list[str]:
    if not isinstance(values, list):
        return []

    output: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = str(value).strip()
        if not text:
            continue
        normalized = text.casefold()
        if normalized in seen:
            continue
        seen.add(normalized)
        output.append(text.lower() if lowercase else text)
    return output


def _sanitize_topics(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []

    allowed = {topic.casefold(): topic for topic in WATCHLIST_TOPICS}
    output: list[str] = []
    seen: set[str] = set()

    for value in values:
        key = str(value).strip().casefold()
        if not key:
            continue
        canonical = allowed.get(key)
        if canonical is None or canonical in seen:
            continue
        seen.add(canonical)
        output.append(canonical)
    return output


def _write_watchlist_file(path: Path, payload: dict[str, list[str]]) -> None:
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    temp_path.replace(path)


def _copy_watchlist(payload: dict[str, list[str]]) -> dict[str, list[str]]:
    return {
        "countries": [str(item) for item in payload.get("countries", [])],
        "topics": [str(item) for item in payload.get("topics", [])],
        "keywords": [str(item) for item in payload.get("keywords", [])],
    }
