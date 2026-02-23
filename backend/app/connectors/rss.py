"""Generic RSS/Atom connector with configurable English-first sources."""

from __future__ import annotations

import json
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any

from app.connectors.base import ConnectorResult, HttpFetcher, parse_datetime
from app.connectors.common import infer_category, infer_severity, normalize_text, text_hash
from app.domain.models import WorldEvent
from app.geo_resolver import GeoResolver

GEO_CENTROIDS_PATH = Path(__file__).resolve().parent.parent / "data" / "country_centroids.json"


@dataclass(frozen=True)
class RssSource:
    name: str
    urls: tuple[str, ...]
    category_hint: str | None = None


class RssConnector:
    name = "RSS"

    def __init__(
        self,
        config_path: Path,
        *,
        fetcher: HttpFetcher | None = None,
        max_items_per_source: int = 40,
        request_delay_seconds: float = 0.25,
    ) -> None:
        self.fetcher = fetcher or HttpFetcher(timeout_seconds=12.0, retries=2)
        self.sources = self._load_sources(config_path)
        self.max_items_per_source = max(5, max_items_per_source)
        self.request_delay_seconds = max(0.0, request_delay_seconds)
        self.geo_resolver = GeoResolver(centroids_path=GEO_CENTROIDS_PATH)

    def fetch(self, *, since_hours: int = 48) -> ConnectorResult:
        started = time.perf_counter()
        cutoff = datetime.now(timezone.utc) - timedelta(hours=max(1, since_hours))
        events: list[WorldEvent] = []
        errors: list[str] = []

        for source in self.sources:
            source_events, source_error = self._fetch_source(source, cutoff=cutoff)
            events.extend(source_events)
            if source_error:
                errors.append(source_error)
            if self.request_delay_seconds > 0:
                time.sleep(self.request_delay_seconds)

        duration_ms = int((time.perf_counter() - started) * 1000)
        return ConnectorResult(
            name=self.name,
            events=events,
            error="; ".join(errors) if errors else None,
            duration_ms=duration_ms,
        )

    def _fetch_source(
        self, source: RssSource, *, cutoff: datetime
    ) -> tuple[list[WorldEvent], str | None]:
        source_errors: list[str] = []
        for url in source.urls:
            try:
                root = self.fetcher.get_xml(url)
                events = self._parse_feed(root=root, source=source, cutoff=cutoff)
                if events:
                    return events, None
            except Exception as exc:
                source_errors.append(f"{source.name}:{url} -> {exc}")
        return [], "; ".join(source_errors) if source_errors else None

    def _parse_feed(
        self, *, root: ET.Element, source: RssSource, cutoff: datetime
    ) -> list[WorldEvent]:
        parsed: list[WorldEvent] = []
        for node in root.iter():
            local = self._local_name(node.tag)
            if local not in {"item", "entry"}:
                continue
            title = self._first_child_text(node, {"title"})
            url = self._extract_link(node)
            if not title or not url:
                continue

            summary = self._first_child_text(node, {"description", "summary", "content", "encoded"})
            published_raw = self._first_child_text(node, {"pubdate", "published", "updated", "date"})
            occurred_at = self._parse_pub_datetime(published_raw)
            if self._parse_iso(occurred_at) < cutoff:
                continue

            body = f"{title} {summary} {source.name}"
            category = source.category_hint or infer_category(body, fallback="other")
            severity = infer_severity(category, body)
            geo = self.geo_resolver.resolve(
                country=None,
                region=None,
                text=body,
            )
            cluster_seed = f"rss|{normalize_text(title)}|{geo.get('country', 'Global')}|{occurred_at[:13]}"
            external_id = f"{source.name}:{url}"
            tags = ["rss", source.name.lower().replace(" ", "-")]

            parsed.append(
                WorldEvent(
                    external_id=external_id,
                    source=source.name,
                    source_url=url,
                    title=title,
                    summary=summary[:240],
                    body_snippet=summary[:320],
                    category=category,
                    tags=tags,
                    country=str(geo.get("country", "Global") or "Global"),
                    region=str(geo.get("region", "Global") or "Global"),
                    lat=geo.get("lat"),
                    lon=geo.get("lon"),
                    geohash=None,
                    severity=severity,
                    confidence=74,
                    occurred_at=occurred_at,
                    started_at=occurred_at,
                    cluster_id=text_hash(cluster_seed)[:20],
                    raw={
                        "source": source.name,
                        "url": url,
                        "summary": summary,
                        "published_raw": published_raw,
                    },
                )
            )
            if len(parsed) >= self.max_items_per_source:
                break
        return parsed

    def _load_sources(self, config_path: Path) -> list[RssSource]:
        payload = json.loads(config_path.read_text(encoding="utf-8"))
        sources: list[RssSource] = []
        for raw in payload.get("sources", []):
            if not isinstance(raw, dict):
                continue
            name = str(raw.get("name", "")).strip()
            if not name:
                continue
            urls_raw = raw.get("urls")
            if isinstance(urls_raw, list):
                urls = [str(item).strip() for item in urls_raw if str(item).strip()]
            else:
                single = str(raw.get("url", "")).strip()
                urls = [single] if single else []
            if not urls:
                continue
            category_hint = str(raw.get("category", "")).strip().lower() or None
            sources.append(RssSource(name=name, urls=tuple(urls), category_hint=category_hint))
        if not sources:
            raise ValueError(f"No valid RSS sources configured in {config_path}")
        return sources

    def _parse_pub_datetime(self, value: str) -> str:
        text = value.strip()
        if not text:
            return parse_datetime(None)
        try:
            parsed = parsedate_to_datetime(text)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace(
                "+00:00", "Z"
            )
        except Exception:
            return parse_datetime(text)

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

    def _local_name(self, tag: str) -> str:
        return tag.rsplit("}", 1)[-1].lower()

    def _first_child_text(self, node: ET.Element, local_names: set[str]) -> str:
        targets = {name.lower() for name in local_names}
        for child in list(node):
            if self._local_name(child.tag) not in targets:
                continue
            text = " ".join(child.itertext()).strip()
            if text:
                return text
        return ""

    def _extract_link(self, node: ET.Element) -> str:
        for child in list(node):
            if self._local_name(child.tag) != "link":
                continue
            href = child.attrib.get("href")
            rel = (child.attrib.get("rel") or "").strip().lower()
            if href and rel in {"", "alternate"}:
                return href.strip()
            text = " ".join(child.itertext()).strip()
            if text:
                return text
        for child in list(node):
            if self._local_name(child.tag) not in {"guid", "id"}:
                continue
            candidate = " ".join(child.itertext()).strip()
            if candidate.startswith("http://") or candidate.startswith("https://"):
                return candidate
        return ""
