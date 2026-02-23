"""Connector abstractions and shared fetch utilities."""

from __future__ import annotations

import json
import logging
import random
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol

from app.domain.models import WorldEvent

LOGGER = logging.getLogger(__name__)
USER_AGENT = "WorldMonitor/0.8 (+https://localhost)"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )


def parse_datetime(value: str | None) -> str:
    text = (value or "").strip()
    if not text:
        return utc_now_iso()
    for candidate in (text, text.replace("Z", "+00:00")):
        try:
            parsed = datetime.fromisoformat(candidate)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return (
                parsed.astimezone(timezone.utc)
                .replace(microsecond=0)
                .isoformat()
                .replace("+00:00", "Z")
            )
        except ValueError:
            continue
    return utc_now_iso()


def stable_external_id(*parts: str) -> str:
    data = "|".join(str(part).strip() for part in parts)
    return str(abs(hash(data)))


@dataclass
class ConnectorResult:
    name: str
    events: list[WorldEvent]
    error: str | None = None
    duration_ms: int = 0


class EventConnector(Protocol):
    name: str

    def fetch(self, *, since_hours: int = 48) -> ConnectorResult: ...


class HttpFetcher:
    def __init__(
        self,
        *,
        timeout_seconds: float = 12.0,
        retries: int = 2,
        base_backoff_seconds: float = 0.6,
    ) -> None:
        self.timeout_seconds = timeout_seconds
        self.retries = max(0, retries)
        self.base_backoff_seconds = max(0.1, base_backoff_seconds)

    def get_bytes(self, url: str, headers: dict[str, str] | None = None) -> bytes:
        req_headers = {
            "User-Agent": USER_AGENT,
            "Accept": "application/json, application/rss+xml, application/atom+xml, text/xml, */*",
        }
        if headers:
            req_headers.update(headers)

        last_error: Exception | None = None
        for attempt in range(self.retries + 1):
            request = urllib.request.Request(url, headers=req_headers)
            try:
                with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                    return response.read()
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
                last_error = exc
                if attempt >= self.retries:
                    break
                delay = self.base_backoff_seconds * (2**attempt) + random.uniform(0.0, 0.25)
                time.sleep(delay)
        raise RuntimeError(f"Request failed for {url}: {last_error}")

    def get_json(self, url: str) -> Any:
        raw = self.get_bytes(url, headers={"Accept": "application/json"})
        return json.loads(raw.decode("utf-8", errors="replace"))

    def get_xml(self, url: str) -> ET.Element:
        raw = self.get_bytes(
            url, headers={"Accept": "application/rss+xml, application/atom+xml, text/xml"}
        )
        return ET.fromstring(raw)


def encode_query(params: dict[str, Any]) -> str:
    filtered = {key: value for key, value in params.items() if value not in (None, "")}
    return urllib.parse.urlencode(filtered)
