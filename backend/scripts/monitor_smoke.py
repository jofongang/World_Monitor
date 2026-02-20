"""Smoke-test script for monitor endpoints: /news, /alerts, /brief, /videos."""

from __future__ import annotations

import json
import os
from urllib.request import urlopen

BASE_URL = os.getenv("WORLD_MONITOR_API", "http://localhost:8000").rstrip("/")


class SmokeFailure(Exception):
    pass


def fetch_json(path: str) -> object:
    url = f"{BASE_URL}{path}"
    with urlopen(url, timeout=20) as response:
        raw = response.read()
    return json.loads(raw)


def expect(condition: bool, message: str) -> None:
    if not condition:
        raise SmokeFailure(message)


def main() -> int:
    news = fetch_json("/news")
    expect(isinstance(news, dict), "/news did not return an object")
    news_items = news.get("items") if isinstance(news, dict) else None
    expect(isinstance(news_items, list), "/news.items missing or invalid")

    alerts = fetch_json("/alerts?since_hours=24")
    expect(isinstance(alerts, dict), "/alerts did not return an object")
    alert_items = alerts.get("items") if isinstance(alerts, dict) else None
    expect(isinstance(alert_items, list), "/alerts.items missing or invalid")

    brief = fetch_json("/brief?window=24h")
    expect(isinstance(brief, dict), "/brief did not return an object")

    required_brief_keys = {
        "generated_at",
        "window",
        "top_alerts",
        "by_region",
        "markets_snapshot",
        "one_paragraph_summary",
    }
    missing = sorted(required_brief_keys.difference(brief.keys()))
    expect(not missing, f"/brief missing keys: {', '.join(missing)}")

    videos = fetch_json("/videos")
    expect(isinstance(videos, list), "/videos did not return a list")

    print(f"NEWS_ITEMS={len(news_items)}")
    print(f"ALERT_ITEMS={len(alert_items)}")
    print(f"BRIEF_WINDOW={brief.get('window')}")
    print(f"VIDEO_ITEMS={len(videos)}")
    print("SMOKE_OK")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SmokeFailure as exc:
        print(f"SMOKE_FAIL {exc}")
        raise SystemExit(1)
    except Exception as exc:
        print(f"SMOKE_FAIL unexpected error: {exc}")
        raise SystemExit(1)
