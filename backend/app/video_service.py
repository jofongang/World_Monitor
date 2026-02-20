"""World Monitor video ingestion service."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import threading
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

LOGGER = logging.getLogger(__name__)
USER_AGENT = "WorldMonitor/0.6 (+http://localhost)"
YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"

MULTISPACE_RE = re.compile(r"\s+")
NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")


@dataclass(frozen=True)
class VideoSource:
    name: str
    feed_url: str
    source_kind: str = "rss"
    video_only: bool = False


VIDEO_SOURCES: tuple[VideoSource, ...] = (
    VideoSource(
        name="Al Jazeera English",
        feed_url="https://www.youtube.com/feeds/videos.xml?channel_id=UCNye-wNBqNL5ZzHSJj3l8Bg",
        source_kind="youtube_rss",
    ),
    VideoSource(
        name="BBC News",
        feed_url="https://feeds.bbci.co.uk/news/world/rss.xml",
        source_kind="rss",
        video_only=True,
    ),
    VideoSource(
        name="DW News",
        feed_url="https://www.youtube.com/feeds/videos.xml?channel_id=UCknLrEdhRCp1aegoMqRaCZg",
        source_kind="youtube_rss",
    ),
    VideoSource(
        name="France 24 English",
        feed_url="https://www.youtube.com/feeds/videos.xml?channel_id=UCQfwfsi5VrQ8yKZ-UWmAEFg",
        source_kind="youtube_rss",
    ),
    VideoSource(
        name="Bloomberg",
        feed_url="https://www.youtube.com/feeds/videos.xml?channel_id=UCIALMKvObZNtJ6AmdCLP7Lg",
        source_kind="youtube_rss",
    ),
    VideoSource(
        name="CNBC",
        feed_url="https://www.youtube.com/feeds/videos.xml?channel_id=UCrp_UI8XtuYfpiqluWLD7Lw",
        source_kind="youtube_rss",
    ),
)

YOUTUBE_API_CHANNELS: tuple[tuple[str, str], ...] = (
    ("Al Jazeera English", "UCNye-wNBqNL5ZzHSJj3l8Bg"),
    ("BBC News", "UC16niRr50-MSBwiO3YDb3RA"),
    ("DW News", "UCknLrEdhRCp1aegoMqRaCZg"),
    ("France 24 English", "UCQfwfsi5VrQ8yKZ-UWmAEFg"),
    ("Bloomberg", "UCIALMKvObZNtJ6AmdCLP7Lg"),
    ("CNBC", "UCrp_UI8XtuYfpiqluWLD7Lw"),
)

TOPIC_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "Conflict",
        (
            "war",
            "conflict",
            "attack",
            "missile",
            "troops",
            "air strike",
            "ceasefire",
        ),
    ),
    (
        "Markets",
        (
            "market",
            "stocks",
            "equity",
            "bond",
            "yield",
            "forex",
            "bitcoin",
            "crypto",
            "trade",
            "dow",
            "nasdaq",
        ),
    ),
    (
        "Economy",
        (
            "economy",
            "economic",
            "inflation",
            "interest rate",
            "gdp",
            "recession",
            "debt",
            "imf",
            "world bank",
        ),
    ),
    (
        "Energy",
        (
            "energy",
            "oil",
            "gas",
            "lng",
            "nuclear",
            "renewable",
            "opec",
            "power grid",
        ),
    ),
    (
        "Infrastructure",
        (
            "infrastructure",
            "port",
            "rail",
            "pipeline",
            "corridor",
            "airport",
            "bridge",
            "construction",
        ),
    ),
    (
        "Politics",
        (
            "election",
            "parliament",
            "president",
            "prime minister",
            "government",
            "policy",
            "sanctions",
        ),
    ),
)


class VideoService:
    def __init__(self) -> None:
        self.cache_seconds = max(60, int(os.getenv("VIDEO_CACHE_SECONDS", "600")))
        self.request_timeout_seconds = max(
            3.0, float(os.getenv("VIDEO_FETCH_TIMEOUT_SECONDS", "10"))
        )
        self.request_delay_seconds = max(
            0.0, float(os.getenv("VIDEO_FETCH_DELAY_SECONDS", "0.2"))
        )
        self.max_items_per_source = max(
            4, int(os.getenv("VIDEO_MAX_ITEMS_PER_SOURCE", "10"))
        )
        self.max_items = max(20, int(os.getenv("VIDEO_MAX_ITEMS", "80")))
        self.youtube_api_key = os.getenv("YOUTUBE_API_KEY", "").strip()

        self._state_lock = threading.Lock()
        self._refresh_lock = threading.Lock()
        self._cache: list[dict[str, Any]] = []
        self._cached_at = 0.0

    def get_videos(self, force_refresh: bool = False) -> list[dict[str, Any]]:
        if force_refresh:
            self.refresh(force=True)
        else:
            self._refresh_if_stale()

        with self._state_lock:
            return [dict(item) for item in self._cache]

    def refresh(self, force: bool = False) -> None:
        now = time.time()
        with self._state_lock:
            cache_valid = now - self._cached_at < self.cache_seconds
            if cache_valid and not force:
                return

        acquired = self._refresh_lock.acquire(blocking=False)
        if not acquired:
            return

        try:
            now = time.time()
            with self._state_lock:
                cache_valid = now - self._cached_at < self.cache_seconds
                if cache_valid and not force:
                    return

            items = self._pull_all_sources()
            if items:
                with self._state_lock:
                    self._cache = items[: self.max_items]
                    self._cached_at = time.time()
            else:
                with self._state_lock:
                    if not self._cache:
                        self._cache = []
                        self._cached_at = time.time()
        except Exception:
            LOGGER.exception("Video refresh failed. Serving cached results.")
        finally:
            self._refresh_lock.release()

    def _refresh_if_stale(self) -> None:
        now = time.time()
        with self._state_lock:
            stale = now - self._cached_at >= self.cache_seconds
            empty = not self._cache
        if stale or empty:
            self.refresh(force=False)

    def _pull_all_sources(self) -> list[dict[str, Any]]:
        seen_urls: set[str] = set()
        seen_title_hashes: set[str] = set()
        collected: list[dict[str, Any]] = []

        for source in VIDEO_SOURCES:
            items = self._safe_fetch_source(source)
            for item in items[: self.max_items_per_source]:
                url_key = str(item.get("url", "")).strip().lower()
                title_hash = str(item.get("_title_hash", "")).strip()
                if url_key and url_key in seen_urls:
                    continue
                if title_hash and title_hash in seen_title_hashes:
                    continue
                if url_key:
                    seen_urls.add(url_key)
                if title_hash:
                    seen_title_hashes.add(title_hash)
                collected.append(item)

            if self.request_delay_seconds > 0:
                time.sleep(self.request_delay_seconds)

        if self.youtube_api_key:
            api_items = self._fetch_optional_youtube_api()
            for item in api_items:
                url_key = str(item.get("url", "")).strip().lower()
                title_hash = str(item.get("_title_hash", "")).strip()
                if url_key and url_key in seen_urls:
                    continue
                if title_hash and title_hash in seen_title_hashes:
                    continue
                if url_key:
                    seen_urls.add(url_key)
                if title_hash:
                    seen_title_hashes.add(title_hash)
                collected.append(item)

        collected.sort(key=lambda entry: float(entry.get("_published_epoch", 0.0)), reverse=True)

        output: list[dict[str, Any]] = []
        for item in collected[: self.max_items]:
            output.append(
                {
                    "id": str(item.get("id", "")),
                    "title": str(item.get("title", "")).strip(),
                    "source": str(item.get("source", "")).strip(),
                    "url": str(item.get("url", "")).strip(),
                    "published_at": str(item.get("published_at", "")).strip(),
                    "topic": str(item.get("topic", "Geopolitics")),
                    "thumbnail": item.get("thumbnail"),
                    "provider": str(item.get("provider", "rss")),
                    "description": str(item.get("description", "")).strip(),
                }
            )

        return output

    def _safe_fetch_source(self, source: VideoSource) -> list[dict[str, Any]]:
        try:
            xml_bytes = self._download_bytes(source.feed_url)
            return self._parse_feed(xml_bytes, source)
        except (HTTPError, URLError, TimeoutError, ET.ParseError) as exc:
            LOGGER.warning("Video source failed '%s': %s", source.name, exc)
        except Exception as exc:
            LOGGER.warning("Unexpected video source failure '%s': %s", source.name, exc)
        return []

    def _parse_feed(self, xml_bytes: bytes, source: VideoSource) -> list[dict[str, Any]]:
        root = ET.fromstring(xml_bytes)
        parsed: list[dict[str, Any]] = []

        for node in root.iter():
            local = _local_name(node.tag)
            if local not in {"item", "entry"}:
                continue

            title = _first_child_text(node, {"title"})
            link = _extract_link(node)
            if not title or not link:
                continue

            if source.video_only and not _looks_like_video_link(link, title):
                continue

            description = _first_child_text(node, {"description", "summary", "content", "encoded"})
            published_raw = _first_child_text(node, {"pubdate", "published", "updated", "date"})
            published_dt = _parse_datetime(published_raw)

            parsed.append(
                {
                    "id": _stable_id(source.name, link, title, published_dt.timestamp()),
                    "title": title.strip(),
                    "source": source.name,
                    "url": link.strip(),
                    "published_at": _utc_iso(published_dt),
                    "topic": _classify_topic(f"{title} {description}"),
                    "thumbnail": _extract_thumbnail(node),
                    "provider": source.source_kind,
                    "description": description.strip(),
                    "_published_epoch": published_dt.timestamp(),
                    "_title_hash": _title_hash(title),
                }
            )

        return parsed

    def _fetch_optional_youtube_api(self) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []

        for source_name, channel_id in YOUTUBE_API_CHANNELS:
            try:
                items.extend(self._fetch_youtube_api_channel(source_name, channel_id))
            except (HTTPError, URLError, TimeoutError, ValueError) as exc:
                LOGGER.warning("YouTube API source failed '%s': %s", source_name, exc)
            except Exception as exc:
                LOGGER.warning("Unexpected YouTube API failure '%s': %s", source_name, exc)

            if self.request_delay_seconds > 0:
                time.sleep(self.request_delay_seconds)

        return items

    def _fetch_youtube_api_channel(self, source_name: str, channel_id: str) -> list[dict[str, Any]]:
        params = urlencode(
            {
                "part": "snippet",
                "channelId": channel_id,
                "maxResults": min(self.max_items_per_source, 10),
                "order": "date",
                "type": "video",
                "key": self.youtube_api_key,
            }
        )
        url = f"{YOUTUBE_SEARCH_URL}?{params}"
        payload = self._download_json(url)

        if not isinstance(payload, dict):
            raise ValueError("Unexpected YouTube API payload")

        output: list[dict[str, Any]] = []
        for raw in payload.get("items", []):
            if not isinstance(raw, dict):
                continue

            raw_id = raw.get("id", {})
            snippet = raw.get("snippet", {})
            if not isinstance(raw_id, dict) or not isinstance(snippet, dict):
                continue

            video_id = str(raw_id.get("videoId", "")).strip()
            if not video_id:
                continue

            title = str(snippet.get("title", "")).strip()
            if not title:
                continue

            description = str(snippet.get("description", "")).strip()
            published_dt = _parse_datetime(str(snippet.get("publishedAt", "")).strip())
            video_url = f"https://www.youtube.com/watch?v={video_id}"

            output.append(
                {
                    "id": _stable_id(source_name, video_url, title, published_dt.timestamp()),
                    "title": title,
                    "source": source_name,
                    "url": video_url,
                    "published_at": _utc_iso(published_dt),
                    "topic": _classify_topic(f"{title} {description}"),
                    "thumbnail": _pick_youtube_thumbnail(snippet.get("thumbnails")),
                    "provider": "youtube_api",
                    "description": description,
                    "_published_epoch": published_dt.timestamp(),
                    "_title_hash": _title_hash(title),
                }
            )

        return output

    def _download_bytes(self, url: str) -> bytes:
        request = Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/rss+xml, application/atom+xml, text/xml;q=0.9, */*;q=0.8",
                "Accept-Encoding": "identity",
            },
        )

        with urlopen(request, timeout=self.request_timeout_seconds) as response:
            return response.read()

    def _download_json(self, url: str) -> object:
        request = Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
            },
        )

        with urlopen(request, timeout=self.request_timeout_seconds) as response:
            raw = response.read().decode("utf-8", errors="replace")
        return json.loads(raw)


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def _first_child_text(node: ET.Element, local_names: set[str]) -> str:
    targets = {name.lower() for name in local_names}
    for child in list(node):
        if _local_name(child.tag) not in targets:
            continue
        text_value = " ".join(child.itertext()).strip()
        if text_value:
            return _strip_html(text_value)
    return ""


def _extract_link(node: ET.Element) -> str:
    for child in list(node):
        if _local_name(child.tag) != "link":
            continue

        href = child.attrib.get("href")
        rel = (child.attrib.get("rel") or "").strip().lower()
        if href and rel in {"", "alternate"}:
            return href.strip()

        text_link = " ".join(child.itertext()).strip()
        if text_link:
            return text_link

    for child in list(node):
        if _local_name(child.tag) not in {"guid", "id"}:
            continue
        candidate = " ".join(child.itertext()).strip()
        if candidate.startswith("http://") or candidate.startswith("https://"):
            return candidate

    return ""


def _extract_thumbnail(node: ET.Element) -> str | None:
    for child in node.iter():
        if _local_name(child.tag) != "thumbnail":
            continue
        url = (child.attrib.get("url") or "").strip()
        if url:
            return url

    for child in node.iter():
        if _local_name(child.tag) != "content":
            continue
        medium = (child.attrib.get("medium") or "").strip().lower()
        if medium != "image":
            continue
        url = (child.attrib.get("url") or "").strip()
        if url:
            return url

    return None


def _pick_youtube_thumbnail(raw_thumbnails: Any) -> str | None:
    if not isinstance(raw_thumbnails, dict):
        return None

    for key in ("high", "medium", "default"):
        candidate = raw_thumbnails.get(key)
        if not isinstance(candidate, dict):
            continue
        url = str(candidate.get("url", "")).strip()
        if url:
            return url

    return None


def _looks_like_video_link(url: str, title: str) -> bool:
    target = f"{url} {title}".lower()
    return (
        "/videos/" in target
        or "/video/" in target
        or "youtube.com/watch" in target
        or "youtu.be/" in target
        or " video" in target
    )


def _strip_html(text: str) -> str:
    cleaned = re.sub(r"<[^>]+>", " ", text)
    return MULTISPACE_RE.sub(" ", cleaned).strip()


def _parse_datetime(value: str) -> datetime:
    text = value.strip()
    if not text:
        return datetime.now(timezone.utc)

    try:
        parsed = parsedate_to_datetime(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except Exception:
        pass

    for candidate in (text, text.replace("Z", "+00:00")):
        try:
            parsed = datetime.fromisoformat(candidate)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except Exception:
            continue

    return datetime.now(timezone.utc)


def _utc_iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )


def _title_hash(title: str) -> str:
    normalized = _normalize_text(title)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _stable_id(source: str, url: str, title: str, published_epoch: float) -> str:
    raw = f"{source}|{url}|{title}|{published_epoch:.0f}".encode("utf-8")
    return hashlib.sha1(raw).hexdigest()[:16]


def _normalize_text(text: str) -> str:
    lowered = text.lower()
    alnum = NON_ALNUM_RE.sub(" ", lowered)
    return MULTISPACE_RE.sub(" ", alnum).strip()


def _classify_topic(text: str) -> str:
    normalized = f" {_normalize_text(text)} "
    for topic, keywords in TOPIC_RULES:
        for keyword in keywords:
            term = _normalize_text(keyword)
            if term and f" {term} " in normalized:
                return topic
    return "Geopolitics"
