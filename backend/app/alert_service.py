"""Deterministic alert generation from watchlist and cached news."""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from app.news_service import NewsService
from app.watchlist_service import WATCHLIST_TOPICS, WatchlistService

LOGGER = logging.getLogger(__name__)
MULTISPACE_RE = re.compile(r"\s+")
NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")

TOPIC_CANONICAL_MAP: dict[str, str] = {
    topic.casefold(): topic for topic in WATCHLIST_TOPICS
}

SEVERITY_HIGH_TERMS: tuple[str, ...] = (
    "conflict",
    "war",
    "attack",
    "attacks",
    "air strike",
    "missile",
    "battle",
    "troops",
    "sanctions",
    "sanction",
    "default",
    "coup",
)

SEVERITY_MEDIUM_TERMS: tuple[str, ...] = (
    "election",
    "protest",
    "strike",
)


class AlertService:
    def __init__(self, news_service: NewsService, watchlist_service: WatchlistService) -> None:
        self.news_service = news_service
        self.watchlist_service = watchlist_service

    def get_alerts(self, since_hours: int = 24) -> dict[str, Any]:
        safe_hours = max(1, int(since_hours))
        try:
            items = self.build_alert_items(since_hours=safe_hours)
        except Exception:
            LOGGER.exception("Alert generation failed. Returning empty alert set.")
            items = []

        return {
            "generated_at": _utc_now_iso(),
            "since_hours": safe_hours,
            "items": items,
        }

    def build_alert_items(self, since_hours: int = 24) -> list[dict[str, Any]]:
        safe_hours = max(1, int(since_hours))
        watchlist = self.watchlist_service.get_watchlist()
        return self._build_alerts(since_hours=safe_hours, watchlist=watchlist)

    def _build_alerts(
        self, since_hours: int, watchlist: dict[str, list[str]]
    ) -> list[dict[str, Any]]:
        news_payload = self.news_service.get_news(force_refresh=False)
        items = news_payload.get("items", []) if isinstance(news_payload, dict) else []
        if not isinstance(items, list) or not items:
            return []

        cutoff = datetime.now(timezone.utc) - timedelta(hours=since_hours)
        country_rules = {country.casefold() for country in watchlist.get("countries", [])}
        topic_rules = {
            _normalize_topic(topic).casefold()
            for topic in watchlist.get("topics", [])
            if _normalize_topic(topic)
        }
        keyword_rules = [
            _normalize_term(keyword)
            for keyword in watchlist.get("keywords", [])
            if _normalize_term(keyword)
        ]

        dedupe_keys: set[str] = set()
        alerts: list[dict[str, Any]] = []

        ordered_items = sorted(
            items,
            key=lambda item: _published_epoch(item.get("published_at")),
            reverse=True,
        )

        for item in ordered_items:
            published_at = str(item.get("published_at", "")).strip()
            published_dt = _parse_datetime(published_at)
            if published_dt is None or published_dt < cutoff:
                continue

            title = str(item.get("title", "")).strip()
            country = str(item.get("country", "")).strip()
            topic = _normalize_topic(item.get("category"))
            url = str(item.get("url", "")).strip()

            normalized_text = _normalize_text(
                " ".join(
                    [
                        title,
                        str(item.get("source", "")),
                        country,
                        topic,
                    ]
                )
            )

            matched_rules: list[str] = []

            if country and country.casefold() in country_rules:
                matched_rules.append(f"country:{country}")

            if topic and topic.casefold() in topic_rules:
                matched_rules.append(f"topic:{topic}")

            for keyword in keyword_rules:
                if _contains_term(normalized_text, keyword):
                    matched_rules.append(f"keyword:{keyword}")

            if not matched_rules:
                continue

            dedupe_key = _build_dedupe_key(url=url, title=title)
            if dedupe_key in dedupe_keys:
                continue
            dedupe_keys.add(dedupe_key)

            alerts.append(
                {
                    "id": len(alerts) + 1,
                    "title": title,
                    "url": url,
                    "published_at": published_at,
                    "country": country,
                    "topic": topic,
                    "severity": _compute_severity(normalized_text, topic),
                    "matched_rules": matched_rules,
                }
            )

        return alerts



def _normalize_text(text: str) -> str:
    lowered = str(text).lower()
    cleaned = NON_ALNUM_RE.sub(" ", lowered)
    squashed = MULTISPACE_RE.sub(" ", cleaned).strip()
    return f" {squashed} " if squashed else ""



def _normalize_term(value: str) -> str:
    term = str(value).strip().lower()
    term = NON_ALNUM_RE.sub(" ", term)
    return MULTISPACE_RE.sub(" ", term).strip()



def _contains_term(normalized_text: str, term: str) -> bool:
    if not normalized_text or not term:
        return False
    return f" {term} " in normalized_text



def _normalize_topic(value: Any) -> str:
    key = str(value).strip().casefold()
    if not key:
        return ""
    if key in TOPIC_CANONICAL_MAP:
        return TOPIC_CANONICAL_MAP[key]
    return str(value).strip().title()



def _compute_severity(normalized_text: str, topic: str) -> str:
    if topic == "Conflict":
        return "High"

    for keyword in SEVERITY_HIGH_TERMS:
        if _contains_term(normalized_text, _normalize_term(keyword)):
            return "High"

    for keyword in SEVERITY_MEDIUM_TERMS:
        if _contains_term(normalized_text, _normalize_term(keyword)):
            return "Medium"

    return "Low"



def _build_dedupe_key(*, url: str, title: str) -> str:
    clean_url = url.strip().casefold()
    if clean_url:
        return f"url:{clean_url}"
    clean_title = _normalize_term(title)
    return f"title:{clean_title}"



def _parse_datetime(value: str) -> datetime | None:
    text = value.strip()
    if not text:
        return None

    candidates = (text, text.replace("Z", "+00:00"))
    for candidate in candidates:
        try:
            parsed = datetime.fromisoformat(candidate)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except ValueError:
            continue
    return None



def _published_epoch(value: Any) -> float:
    parsed = _parse_datetime(str(value))
    if parsed is None:
        return 0.0
    return parsed.timestamp()



def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )
