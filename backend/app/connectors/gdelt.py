"""GDELT article connector (free when service is reachable)."""

from __future__ import annotations

import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from app.connectors.base import ConnectorResult, HttpFetcher, encode_query, parse_datetime
from app.connectors.common import infer_category, infer_severity, text_hash
from app.domain.models import WorldEvent


class GdeltConnector:
    name = "GDELT"

    def __init__(self, fetcher: HttpFetcher | None = None) -> None:
        self.fetcher = fetcher or HttpFetcher(timeout_seconds=12.0, retries=1)
        self.query = os.getenv(
            "GDELT_QUERY",
            "(conflict OR sanctions OR earthquake OR cyclone OR cyber OR diplomacy)",
        ).strip()
        self.max_records = max(20, min(int(os.getenv("GDELT_MAX_RECORDS", "100")), 250))

    def fetch(self, *, since_hours: int = 48) -> ConnectorResult:
        started = time.perf_counter()
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(hours=max(1, since_hours))
            url = (
                "https://api.gdeltproject.org/api/v2/doc/doc?"
                + encode_query(
                    {
                        "query": self.query,
                        "mode": "ArtList",
                        "format": "json",
                        "sort": "datedesc",
                        "timespan": f"{max(1, since_hours)}h",
                        "maxrecords": self.max_records,
                    }
                )
            )
            payload = self.fetcher.get_json(url)
            articles = payload.get("articles", []) if isinstance(payload, dict) else []
            events: list[WorldEvent] = []
            for article in articles:
                event = self._to_event(article, cutoff=cutoff)
                if event is not None:
                    events.append(event)
            duration_ms = int((time.perf_counter() - started) * 1000)
            return ConnectorResult(name=self.name, events=events, duration_ms=duration_ms)
        except Exception as exc:
            duration_ms = int((time.perf_counter() - started) * 1000)
            return ConnectorResult(
                name=self.name,
                events=[],
                error=str(exc),
                duration_ms=duration_ms,
            )

    def _to_event(self, article: Any, cutoff: datetime) -> WorldEvent | None:
        if not isinstance(article, dict):
            return None
        title = str(article.get("title", "")).strip()
        url = str(article.get("url", "")).strip()
        if not title or not url:
            return None

        occurred_at = parse_datetime(str(article.get("seendate", "")))
        if self._parse_iso(occurred_at) < cutoff:
            return None

        source = str(article.get("sourcecountry", "")).strip() or self.name
        source_name = str(article.get("domain", "")).strip() or self.name
        summary = str(article.get("snippet", "")).strip()
        body = f"{title} {summary} {source_name}"
        category = infer_category(body, fallback="other")
        severity = infer_severity(category, body)

        cluster_id = text_hash(f"gdelt|{title}|{occurred_at[:13]}")[:20]
        external_id = str(article.get("url_mobile", "")).strip() or url

        return WorldEvent(
            external_id=external_id,
            source=f"{self.name}:{source_name}",
            source_url=url,
            title=title,
            summary=summary or "GDELT article",
            body_snippet=summary[:240],
            category=category,
            tags=["gdelt", source.lower()],
            country=source if source else "Global",
            region="Global",
            lat=None,
            lon=None,
            geohash=None,
            severity=severity,
            confidence=64,
            occurred_at=occurred_at,
            started_at=occurred_at,
            cluster_id=cluster_id,
            raw=article,
        )

    def _parse_iso(self, value: str) -> datetime:
        for candidate in (value, value.replace("Z", "+00:00")):
            try:
                parsed = datetime.fromisoformat(candidate)
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=timezone.utc)
                return parsed.astimezone(timezone.utc)
            except ValueError:
                continue
        return datetime.now(timezone.utc)
