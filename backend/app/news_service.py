"""
World Monitor news ingestion service.

Fetches RSS/Atom feeds from configured sources, classifies stories,
tags regions, deduplicates items, and caches results in memory.
"""

from __future__ import annotations

import asyncio
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
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError

from app.geo_resolver import GeoResolver
from urllib.request import Request, urlopen

LOGGER = logging.getLogger(__name__)
USER_AGENT = "WorldMonitor/0.2 (+http://localhost)"
GEO_CENTROIDS_PATH = Path(__file__).resolve().parent / "data" / "country_centroids.json"

HTML_TAG_RE = re.compile(r"<[^>]+>")
NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")
MULTISPACE_RE = re.compile(r"\s+")


def _normalize_text(text: str) -> str:
    lowered = text.lower()
    alnum = NON_ALNUM_RE.sub(" ", lowered)
    return MULTISPACE_RE.sub(" ", alnum).strip()

CATEGORY_RULES: list[tuple[str, tuple[str, ...]]] = [
    (
        "conflict",
        (
            "war",
            "conflict",
            "military",
            "missile",
            "air strike",
            "troops",
            "ceasefire",
            "terror",
            "battle",
            "insurgent",
            "armed group",
            "security council",
        ),
    ),
    (
        "energy",
        (
            "energy",
            "oil",
            "gas",
            "lng",
            "nuclear",
            "renewable",
            "solar",
            "wind",
            "electricity",
            "power grid",
            "opec",
            "petroleum",
        ),
    ),
    (
        "markets",
        (
            "market",
            "stocks",
            "equity",
            "bond",
            "yield",
            "index",
            "forex",
            "currency",
            "investor",
            "trading",
            "bitcoin",
            "crypto",
        ),
    ),
    (
        "infrastructure",
        (
            "infrastructure",
            "port",
            "rail",
            "railway",
            "road",
            "bridge",
            "pipeline",
            "corridor",
            "airport",
            "transport",
            "construction",
            "grid expansion",
        ),
    ),
    (
        "economy",
        (
            "economy",
            "economic",
            "gdp",
            "inflation",
            "interest rate",
            "central bank",
            "fiscal",
            "debt",
            "growth",
            "recession",
            "trade",
            "budget",
            "finance",
            "imf",
            "world bank",
        ),
    ),
    (
        "politics",
        (
            "election",
            "parliament",
            "government",
            "minister",
            "president",
            "prime minister",
            "cabinet",
            "policy",
            "vote",
            "lawmakers",
            "legislation",
            "sanction",
        ),
    ),
    (
        "geopolitics",
        (
            "summit",
            "diplomatic",
            "diplomacy",
            "foreign policy",
            "alliance",
            "border",
            "nato",
            "regional bloc",
            "bilateral",
            "multilateral",
            "united nations",
            "geopolitical",
        ),
    ),
]

COUNTRY_SPECS: list[tuple[str, str, tuple[str, ...]]] = [
    ("United States", "North America", ("united states", "usa", "american")),
    ("Canada", "North America", ("canada", "canadian")),
    ("Mexico", "North America", ("mexico", "mexican")),
    ("Brazil", "Latin America", ("brazil", "brazilian")),
    ("Argentina", "Latin America", ("argentina", "argentine")),
    ("Chile", "Latin America", ("chile", "chilean")),
    ("Colombia", "Latin America", ("colombia", "colombian")),
    ("Peru", "Latin America", ("peru", "peruvian")),
    ("United Kingdom", "Europe", ("united kingdom", "britain", "british", "uk")),
    ("France", "Europe", ("france", "french")),
    ("Germany", "Europe", ("germany", "german")),
    ("Italy", "Europe", ("italy", "italian")),
    ("Spain", "Europe", ("spain", "spanish")),
    ("Poland", "Europe", ("poland", "polish")),
    ("Ukraine", "Europe", ("ukraine", "ukrainian")),
    ("Russia", "Europe", ("russia", "russian")),
    ("European Union", "Europe", ("european union", "eu")),
    ("China", "Asia", ("china", "chinese")),
    ("India", "Asia", ("india", "indian")),
    ("Japan", "Asia", ("japan", "japanese")),
    ("South Korea", "Asia", ("south korea", "korean")),
    ("Taiwan", "Asia", ("taiwan", "taiwanese")),
    ("Indonesia", "Asia", ("indonesia", "indonesian")),
    ("Pakistan", "Asia", ("pakistan", "pakistani")),
    ("Bangladesh", "Asia", ("bangladesh", "bangladeshi")),
    ("Saudi Arabia", "Middle East", ("saudi arabia", "saudi")),
    ("United Arab Emirates", "Middle East", ("united arab emirates", "uae")),
    ("Qatar", "Middle East", ("qatar", "qatari")),
    ("Iran", "Middle East", ("iran", "iranian")),
    ("Iraq", "Middle East", ("iraq", "iraqi")),
    ("Israel", "Middle East", ("israel", "israeli")),
    ("Palestine", "Middle East", ("palestine", "palestinian", "gaza", "west bank")),
    ("Syria", "Middle East", ("syria", "syrian")),
    ("Yemen", "Middle East", ("yemen", "yemeni")),
    ("Turkey", "Middle East", ("turkey", "turkish")),
    ("Egypt", "Middle East", ("egypt", "egyptian")),
    ("Nigeria", "Africa", ("nigeria", "nigerian")),
    ("Kenya", "Africa", ("kenya", "kenyan")),
    ("Ethiopia", "Africa", ("ethiopia", "ethiopian")),
    ("South Africa", "Africa", ("south africa", "south african")),
    ("Ghana", "Africa", ("ghana", "ghanaian")),
    ("Sudan", "Africa", ("sudan", "sudanese")),
    ("Morocco", "Africa", ("morocco", "moroccan")),
    ("Algeria", "Africa", ("algeria", "algerian")),
    ("Tunisia", "Africa", ("tunisia", "tunisian")),
    ("Tanzania", "Africa", ("tanzania", "tanzanian")),
    ("Uganda", "Africa", ("uganda", "ugandan")),
    ("Rwanda", "Africa", ("rwanda", "rwandan")),
    ("Democratic Republic of the Congo", "Africa", ("democratic republic of the congo", "drc")),
    ("Congo", "Africa", ("republic of the congo", "congo brazzaville")),
    ("Cameroon", "Africa", ("cameroon", "cameroonian")),
    ("Senegal", "Africa", ("senegal", "senegalese")),
    ("Zimbabwe", "Africa", ("zimbabwe", "zimbabwean")),
    ("Zambia", "Africa", ("zambia", "zambian")),
    ("Australia", "Oceania", ("australia", "australian")),
    ("New Zealand", "Oceania", ("new zealand", "new zealander")),
]

NORMALIZED_COUNTRY_SPECS: list[tuple[str, str, tuple[str, ...]]] = [
    (
        country_name,
        region_name,
        tuple(_kw for _kw in (_normalize_text(keyword) for keyword in keywords) if _kw),
    )
    for country_name, region_name, keywords in COUNTRY_SPECS
]


@dataclass(frozen=True)
class FeedSource:
    name: str
    urls: tuple[str, ...]


class NewsService:
    def __init__(self, config_path: Path) -> None:
        self.config_path = config_path
        self.sources = self._load_sources(config_path)
        self.geo_resolver = GeoResolver(centroids_path=GEO_CENTROIDS_PATH)

        self.refresh_interval_minutes = max(1, int(os.getenv("NEWS_REFRESH_MINUTES", "10")))
        self.refresh_interval_seconds = self.refresh_interval_minutes * 60
        self.force_refresh_cooldown_seconds = max(
            10, int(os.getenv("NEWS_FORCE_REFRESH_COOLDOWN_SECONDS", "45"))
        )
        self.request_timeout_seconds = max(
            3.0, float(os.getenv("NEWS_FETCH_TIMEOUT_SECONDS", "10"))
        )
        self.request_delay_seconds = max(0.0, float(os.getenv("NEWS_FETCH_DELAY_SECONDS", "0.35")))
        self.max_items_per_source = max(5, int(os.getenv("NEWS_MAX_ITEMS_PER_SOURCE", "35")))
        self.max_items = max(20, int(os.getenv("NEWS_MAX_ITEMS", "120")))
        self.scheduler_enabled = (
            os.getenv("NEWS_SCHEDULER_ENABLED", "1").strip().lower()
            not in {"0", "false", "no", "off"}
        )

        self._state_lock = threading.Lock()
        self._refresh_lock = threading.Lock()
        self._cache: list[dict[str, Any]] = []
        self._last_updated: str | None = None
        self._last_refresh_attempt = 0.0
        self._last_refresh_success = 0.0
        self._scheduler_task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        self.refresh_async(force=True, bypass_cooldown=True)
        if self.scheduler_enabled and self._scheduler_task is None:
            self._scheduler_task = asyncio.create_task(self._scheduler_loop())

    async def stop(self) -> None:
        if self._scheduler_task is None:
            return
        self._scheduler_task.cancel()
        try:
            await self._scheduler_task
        except asyncio.CancelledError:
            pass
        finally:
            self._scheduler_task = None

    def get_news(self, force_refresh: bool = False) -> dict[str, Any]:
        if force_refresh:
            self.refresh_async(force=True)
        else:
            self._refresh_if_stale()

        with self._state_lock:
            return {
                "items": [dict(item) for item in self._cache],
                "last_updated": self._last_updated,
            }

    async def _scheduler_loop(self) -> None:
        while True:
            await asyncio.sleep(self.refresh_interval_seconds)
            await asyncio.to_thread(self.refresh, False, False)

    def _refresh_if_stale(self) -> None:
        now = time.time()
        with self._state_lock:
            has_cache = bool(self._cache)
            stale = (not has_cache) or (
                now - self._last_refresh_attempt >= self.refresh_interval_seconds
            )
        if not has_cache:
            self.refresh_async(force=True)
        elif stale:
            self.refresh_async(force=False)

    def refresh_async(self, force: bool = False, bypass_cooldown: bool = False) -> None:
        if self._refresh_lock.locked():
            return
        thread = threading.Thread(
            target=self.refresh,
            kwargs={"force": force, "bypass_cooldown": bypass_cooldown},
            daemon=True,
        )
        thread.start()

    def refresh(self, force: bool = False, bypass_cooldown: bool = False) -> None:
        now = time.time()
        with self._state_lock:
            if force and self._cache and not bypass_cooldown:
                if now - self._last_refresh_attempt < self.force_refresh_cooldown_seconds:
                    return
            if not force and self._cache:
                if now - self._last_refresh_attempt < self.refresh_interval_seconds:
                    return

        acquired = self._refresh_lock.acquire(blocking=False)
        if not acquired:
            return

        try:
            now = time.time()
            with self._state_lock:
                if force and self._cache and not bypass_cooldown:
                    if now - self._last_refresh_attempt < self.force_refresh_cooldown_seconds:
                        return
                if not force and self._cache:
                    if now - self._last_refresh_attempt < self.refresh_interval_seconds:
                        return
                self._last_refresh_attempt = now

            items = self._pull_all_sources()
            if items:
                refreshed_at = _utc_iso(datetime.now(timezone.utc))
                with self._state_lock:
                    self._cache = items[: self.max_items]
                    self._last_updated = refreshed_at
                    self._last_refresh_success = now
            else:
                with self._state_lock:
                    if self._last_updated is None:
                        self._last_updated = _utc_iso(datetime.now(timezone.utc))
        except Exception:
            LOGGER.exception("News refresh failed.")
        finally:
            self._refresh_lock.release()

    def _pull_all_sources(self) -> list[dict[str, Any]]:
        seen_urls: set[str] = set()
        seen_title_hashes: set[str] = set()
        collected: list[dict[str, Any]] = []

        for source in self.sources:
            source_items = self._fetch_source(source)
            for item in source_items[: self.max_items_per_source]:
                url_key = item["url"].strip().lower()
                title_hash = item["_title_hash"]
                if url_key in seen_urls or title_hash in seen_title_hashes:
                    continue
                seen_urls.add(url_key)
                seen_title_hashes.add(title_hash)
                collected.append(item)

            if self.request_delay_seconds > 0:
                time.sleep(self.request_delay_seconds)

        collected.sort(key=lambda entry: entry["_published_epoch"], reverse=True)

        output: list[dict[str, Any]] = []
        for index, item in enumerate(collected, start=1):
            geo = self.geo_resolver.resolve(
                country=item.get("country"),
                region=item.get("region"),
                text=item.get("_geo_text", ""),
            )
            output.append(
                {
                    "id": index,
                    "title": item["title"],
                    "source": item["source"],
                    "url": item["url"],
                    "published_at": item["published_at"],
                    "category": item["category"],
                    "region": geo["region"],
                    "country": geo["country"],
                    "lat": geo["lat"],
                    "lon": geo["lon"],
                    "location_label": geo["location_label"],
                }
            )
        return output

    def _fetch_source(self, source: FeedSource) -> list[dict[str, Any]]:
        for url in source.urls:
            try:
                xml_bytes = self._download(url)
                items = self._parse_feed(xml_bytes, source.name)
                if items:
                    return items
                LOGGER.warning(
                    "No parseable entries from source '%s' URL '%s'", source.name, url
                )
            except (HTTPError, URLError, TimeoutError, ET.ParseError) as exc:
                LOGGER.warning("Failed source '%s' URL '%s': %s", source.name, url, exc)
            except Exception as exc:
                LOGGER.warning(
                    "Unexpected source failure '%s' URL '%s': %s",
                    source.name,
                    url,
                    exc,
                )
        return []

    def _download(self, url: str) -> bytes:
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

    def _parse_feed(self, xml_bytes: bytes, source_name: str) -> list[dict[str, Any]]:
        root = ET.fromstring(xml_bytes)
        parsed_items: list[dict[str, Any]] = []

        for node in root.iter():
            if _local_name(node.tag) not in {"item", "entry"}:
                continue

            title = _first_child_text(node, {"title"})
            link = _extract_link(node)
            if not title or not link:
                continue

            summary = _first_child_text(node, {"description", "summary", "content", "encoded"})
            published_raw = _first_child_text(
                node, {"pubdate", "published", "updated", "date"}
            )
            published_dt = _parse_datetime(published_raw)

            normalized_title = _normalize_text(title)
            combined_text = f"{title} {summary}"
            category = _classify_category(combined_text, source_name)
            region, country = _detect_region_country(combined_text)

            parsed_items.append(
                {
                    "title": title.strip(),
                    "source": source_name,
                    "url": link.strip(),
                    "published_at": _utc_iso(published_dt),
                    "category": category,
                    "region": region,
                    "country": country,
                    "_geo_text": combined_text,
                    "_published_epoch": published_dt.timestamp(),
                    "_title_hash": hashlib.sha256(normalized_title.encode("utf-8")).hexdigest(),
                }
            )
        return parsed_items

    @staticmethod
    def _load_sources(config_path: Path) -> list[FeedSource]:
        data = json.loads(config_path.read_text(encoding="utf-8"))
        sources: list[FeedSource] = []

        for source_obj in data.get("sources", []):
            name = str(source_obj.get("name", "")).strip()
            urls_raw = source_obj.get("urls")

            urls: list[str]
            if isinstance(urls_raw, list):
                urls = [str(url).strip() for url in urls_raw if str(url).strip()]
            else:
                single_url = str(source_obj.get("url", "")).strip()
                urls = [single_url] if single_url else []

            if not name or not urls:
                continue
            sources.append(FeedSource(name=name, urls=tuple(urls)))

        if not sources:
            raise ValueError(f"No valid RSS/Atom sources found in {config_path}")
        return sources


def _classify_category(text: str, source_name: str) -> str:
    normalized = f" {_normalize_text(text)} "

    for category, keywords in CATEGORY_RULES:
        for keyword in keywords:
            normalized_keyword = _normalize_text(keyword)
            if normalized_keyword and f" {normalized_keyword} " in normalized:
                return category

    source_normalized = _normalize_text(source_name)
    if "imf" in source_normalized or "world bank" in source_normalized or "afdb" in source_normalized:
        return "economy"
    return "geopolitics"


def _detect_region_country(text: str) -> tuple[str, str]:
    normalized = f" {_normalize_text(text)} "
    for country, region, keywords in NORMALIZED_COUNTRY_SPECS:
        for keyword in keywords:
            if f" {keyword} " in normalized:
                return region, country
    return "Global", "Global"


def _first_child_text(node: ET.Element, local_names: set[str]) -> str:
    target_names = {name.lower() for name in local_names}
    for child in list(node):
        if _local_name(child.tag) not in target_names:
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
        if href:
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


def _parse_datetime(value: str) -> datetime:
    if not value:
        return datetime.now(timezone.utc)

    text = value.strip()

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


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def _strip_html(text: str) -> str:
    cleaned = HTML_TAG_RE.sub(" ", text)
    return MULTISPACE_RE.sub(" ", cleaned).strip()


def _utc_iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )





