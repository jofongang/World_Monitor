"""NASA EONET connector for public natural event data."""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Any

from app.connectors.base import ConnectorResult, HttpFetcher, encode_query, parse_datetime
from app.connectors.common import infer_severity, text_hash
from app.domain.models import WorldEvent


class EonetConnector:
    name = "NASA EONET"

    def __init__(self, fetcher: HttpFetcher | None = None) -> None:
        self.fetcher = fetcher or HttpFetcher(timeout_seconds=12.0, retries=2)

    def fetch(self, *, since_hours: int = 48) -> ConnectorResult:
        started = time.perf_counter()
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(hours=max(1, since_hours))
            params = {
                "status": "all",
                "days": min(365, max(1, int(since_hours / 24) + 2)),
            }
            url = f"https://eonet.gsfc.nasa.gov/api/v3/events?{encode_query(params)}"
            payload = self.fetcher.get_json(url)
            raw_events = payload.get("events", []) if isinstance(payload, dict) else []
            events: list[WorldEvent] = []
            for raw in raw_events:
                event = self._to_event(raw, cutoff=cutoff)
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

    def _to_event(self, raw: Any, cutoff: datetime) -> WorldEvent | None:
        if not isinstance(raw, dict):
            return None
        external_id = str(raw.get("id", "")).strip()
        title = str(raw.get("title", "")).strip()
        if not external_id or not title:
            return None

        sources = raw.get("sources", [])
        source_url = "https://eonet.gsfc.nasa.gov/"
        if isinstance(sources, list) and sources:
            candidate = sources[0]
            if isinstance(candidate, dict):
                source_url = str(candidate.get("url", source_url)).strip() or source_url

        categories = raw.get("categories", [])
        category_titles: list[str] = []
        if isinstance(categories, list):
            for item in categories:
                if isinstance(item, dict):
                    text = str(item.get("title", "")).strip()
                    if text:
                        category_titles.append(text)

        geometry_list = raw.get("geometry", [])
        occurred_at = parse_datetime(None)
        lat: float | None = None
        lon: float | None = None
        if isinstance(geometry_list, list) and geometry_list:
            latest = geometry_list[-1]
            if isinstance(latest, dict):
                occurred_at = parse_datetime(str(latest.get("date", "")))
                coords = latest.get("coordinates")
                if isinstance(coords, list) and len(coords) >= 2:
                    try:
                        lon = float(coords[0])
                        lat = float(coords[1])
                    except (TypeError, ValueError):
                        lat, lon = None, None

        if self._parse_iso(occurred_at) < cutoff:
            return None

        tags = ["nasa-eonet"] + [item.lower() for item in category_titles]
        text = " ".join([title, *category_titles])
        severity = infer_severity("disaster", text)
        cluster_id = text_hash(f"eonet|{title}|{occurred_at[:13]}")[:20]

        return WorldEvent(
            external_id=external_id,
            source=self.name,
            source_url=source_url,
            title=title,
            summary=", ".join(category_titles) or "Natural event update",
            body_snippet=" / ".join(category_titles),
            category="disaster",
            tags=tags,
            country="Global",
            region="Global",
            lat=lat,
            lon=lon,
            geohash=None,
            severity=severity,
            confidence=82,
            occurred_at=occurred_at,
            started_at=occurred_at,
            cluster_id=cluster_id,
            raw=raw,
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
