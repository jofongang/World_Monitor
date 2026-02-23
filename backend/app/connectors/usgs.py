"""USGS Earthquake feed connector (free public data)."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

from app.connectors.base import ConnectorResult, HttpFetcher, parse_datetime
from app.connectors.common import infer_severity, normalize_text, text_hash
from app.domain.models import WorldEvent


class UsgsConnector:
    name = "USGS Earthquakes"

    def __init__(self, fetcher: HttpFetcher | None = None) -> None:
        self.fetcher = fetcher or HttpFetcher(timeout_seconds=12.0, retries=2)

    def fetch(self, *, since_hours: int = 48) -> ConnectorResult:
        started = time.perf_counter()
        try:
            url = self._resolve_feed_url(since_hours)
            payload = self.fetcher.get_json(url)
            features = payload.get("features", []) if isinstance(payload, dict) else []
            events: list[WorldEvent] = []
            for feature in features:
                event = self._to_event(feature)
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

    def _resolve_feed_url(self, since_hours: int) -> str:
        safe = max(1, since_hours)
        if safe <= 24:
            window = "all_day"
        elif safe <= 24 * 7:
            window = "all_week"
        else:
            window = "all_month"
        return f"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{window}.geojson"

    def _to_event(self, feature: Any) -> WorldEvent | None:
        if not isinstance(feature, dict):
            return None
        props = feature.get("properties", {})
        geometry = feature.get("geometry", {})
        if not isinstance(props, dict):
            return None
        if not isinstance(geometry, dict):
            geometry = {}

        external_id = str(feature.get("id", "")).strip()
        if not external_id:
            return None
        title = str(props.get("title", "")).strip()
        if not title:
            return None
        place = str(props.get("place", "")).strip()
        url = str(props.get("url", "")).strip() or "https://earthquake.usgs.gov/"
        magnitude = props.get("mag")
        try:
            magnitude_value = float(magnitude) if magnitude is not None else None
        except (TypeError, ValueError):
            magnitude_value = None

        occurred_ms = props.get("time")
        occurred_at = self._format_epoch_ms(occurred_ms)
        lat, lon = self._extract_lat_lon(geometry)
        country, region = self._country_region_from_place(place)
        text = f"{title} {place}"
        severity = infer_severity("disaster", text)
        if magnitude_value is not None:
            severity = max(severity, min(100, int(45 + magnitude_value * 10)))

        cluster_seed = f"usgs|{normalize_text(place)}|{occurred_at[:13]}"
        return WorldEvent(
            external_id=external_id,
            source=self.name,
            source_url=url,
            title=title,
            summary=place or "Earthquake update",
            body_snippet=f"Magnitude {magnitude_value}" if magnitude_value is not None else "",
            category="disaster",
            tags=["earthquake", f"mag:{magnitude_value}" if magnitude_value is not None else "mag:na"],
            country=country,
            region=region,
            lat=lat,
            lon=lon,
            geohash=None,
            severity=severity,
            confidence=88,
            occurred_at=occurred_at,
            started_at=occurred_at,
            cluster_id=text_hash(cluster_seed)[:20],
            raw=feature,
        )

    def _extract_lat_lon(self, geometry: dict[str, Any]) -> tuple[float | None, float | None]:
        coords = geometry.get("coordinates")
        if not isinstance(coords, list) or len(coords) < 2:
            return None, None
        try:
            lon = float(coords[0])
            lat = float(coords[1])
            return lat, lon
        except (TypeError, ValueError):
            return None, None

    def _format_epoch_ms(self, value: Any) -> str:
        try:
            ts = float(value) / 1000.0
        except (TypeError, ValueError):
            return parse_datetime(None)
        parsed = datetime.fromtimestamp(ts, tz=timezone.utc)
        return parsed.replace(microsecond=0).isoformat().replace("+00:00", "Z")

    def _country_region_from_place(self, place: str) -> tuple[str, str]:
        text = place.strip()
        if not text:
            return "Global", "Global"
        if "," in text:
            candidate = text.split(",")[-1].strip()
            if candidate:
                return candidate, "Global"
        return "Global", "Global"
