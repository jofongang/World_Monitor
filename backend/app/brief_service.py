"""Rule-based daily brief builder for the World Monitor dashboard."""

from __future__ import annotations

import logging
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any

from app.alert_service import AlertService
from app.market_service import MarketService
from app.news_service import NewsService
from app.watchlist_service import WATCHLIST_TOPICS

LOGGER = logging.getLogger(__name__)
TOPIC_CANONICAL_MAP: dict[str, str] = {
    topic.casefold(): topic for topic in WATCHLIST_TOPICS
}

SEVERITY_RANK: dict[str, int] = {
    "High": 3,
    "Medium": 2,
    "Low": 1,
}


class BriefService:
    def __init__(
        self,
        news_service: NewsService,
        market_service: MarketService,
        alert_service: AlertService,
    ) -> None:
        self.news_service = news_service
        self.market_service = market_service
        self.alert_service = alert_service

    def get_brief(self, window: str) -> dict[str, Any]:
        normalized_window = _normalize_window(window)
        since_hours = 24 if normalized_window == "24h" else 7 * 24

        window_news = self._safe_news_window(since_hours=since_hours)
        alerts = self._safe_alerts(since_hours=since_hours)

        top_alerts = _select_top_alerts(alerts, limit=8)
        by_region = _build_by_region(window_news)
        markets_snapshot = self._safe_markets_snapshot()
        summary = _build_summary(
            window=normalized_window,
            alerts=alerts,
            by_region=by_region,
            markets_snapshot=markets_snapshot,
        )

        return {
            "generated_at": _utc_now_iso(),
            "window": normalized_window,
            "top_alerts": top_alerts,
            "by_region": by_region,
            "markets_snapshot": markets_snapshot,
            "one_paragraph_summary": summary,
        }

    def _safe_news_window(self, *, since_hours: int) -> list[dict[str, Any]]:
        try:
            news_payload = self.news_service.get_news(force_refresh=False)
            raw_items = news_payload.get("items", []) if isinstance(news_payload, dict) else []
            news_items = [item for item in raw_items if isinstance(item, dict)]
            return _filter_news_window(news_items, since_hours=since_hours)
        except Exception:
            LOGGER.exception("Brief news collection failed. Continuing with empty news set.")
            return []

    def _safe_alerts(self, *, since_hours: int) -> list[dict[str, Any]]:
        try:
            alerts = self.alert_service.build_alert_items(since_hours=since_hours)
            return [item for item in alerts if isinstance(item, dict)]
        except Exception:
            LOGGER.exception("Brief alert collection failed. Continuing with empty alerts.")
            return []

    def _safe_markets_snapshot(self) -> list[dict[str, Any]]:
        try:
            data = self.market_service.get_markets()
            if isinstance(data, list):
                return [item for item in data if isinstance(item, dict)]
        except Exception:
            LOGGER.exception("Brief markets snapshot failed. Continuing with empty markets.")
            return []
        return []



def _normalize_window(window: str) -> str:
    candidate = str(window).strip().lower()
    if candidate == "7d":
        return "7d"
    return "24h"



def _filter_news_window(items: list[dict[str, Any]], since_hours: int) -> list[dict[str, Any]]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=since_hours)
    output: list[dict[str, Any]] = []

    for item in items:
        published_at = str(item.get("published_at", "")).strip()
        published_dt = _parse_datetime(published_at)
        if published_dt is None or published_dt < cutoff:
            continue
        output.append(item)

    output.sort(
        key=lambda entry: _published_epoch(entry.get("published_at")),
        reverse=True,
    )
    return output



def _select_top_alerts(alerts: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    ranked = sorted(
        alerts,
        key=lambda item: (
            -SEVERITY_RANK.get(str(item.get("severity", "Low")), 1),
            -_published_epoch(item.get("published_at")),
            str(item.get("title", "")),
        ),
    )
    return ranked[: max(1, limit)]



def _build_by_region(news_items: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}

    for item in news_items:
        region = str(item.get("region", "")).strip() or "Global"
        grouped.setdefault(region, []).append(
            {
                "title": str(item.get("title", "")).strip(),
                "country": str(item.get("country", "")).strip(),
                "topic": _normalize_topic(item.get("category")),
                "published_at": str(item.get("published_at", "")).strip(),
                "url": str(item.get("url", "")).strip(),
            }
        )

    output: dict[str, list[dict[str, Any]]] = {}
    for region in sorted(grouped.keys()):
        output[region] = grouped[region][:5]
    return output



def _build_summary(
    *,
    window: str,
    alerts: list[dict[str, Any]],
    by_region: dict[str, list[dict[str, Any]]],
    markets_snapshot: list[dict[str, Any]],
) -> str:
    window_text = "24 hours" if window == "24h" else "7 days"

    high_count = sum(1 for alert in alerts if str(alert.get("severity")) == "High")
    medium_count = sum(1 for alert in alerts if str(alert.get("severity")) == "Medium")
    low_count = sum(1 for alert in alerts if str(alert.get("severity")) == "Low")

    if alerts:
        region_counts = sorted(
            ((region, len(items)) for region, items in by_region.items() if items),
            key=lambda entry: (-entry[1], entry[0]),
        )
        focus_regions = ", ".join(region for region, _ in region_counts[:2]) or "multiple regions"
        developments = (
            f"{len(alerts)} watchlist alerts ({high_count} high, {medium_count} medium, "
            f"{low_count} low), with the highest concentration in {focus_regions}"
        )
    else:
        developments = "no watchlist alerts that met the current rules"

    markets_line = _build_market_summary(markets_snapshot)
    risks_line = _build_risk_summary(alerts=alerts, high_count=high_count, medium_count=medium_count)

    return (
        f"In the last {window_text}, the main developments were {developments}. "
        f"Markets were {markets_line}. Key risks are {risks_line}."
    )



def _build_market_summary(markets_snapshot: list[dict[str, Any]]) -> str:
    if not markets_snapshot:
        return "unavailable because market providers did not return a valid snapshot"

    movers: list[tuple[str, float]] = []
    for item in markets_snapshot:
        symbol = str(item.get("symbol", "")).strip()
        change_pct = item.get("change_pct")
        if not symbol or change_pct is None:
            continue
        try:
            change_value = float(change_pct)
        except (TypeError, ValueError):
            continue
        movers.append((symbol, change_value))

    if not movers:
        return "partially unavailable with provider fallbacks active"

    movers.sort(key=lambda entry: abs(entry[1]), reverse=True)
    top = movers[:2]
    if len(top) == 1:
        return f"mixed, led by {top[0][0]} {top[0][1]:+.2f}%"

    return (
        f"mixed, led by {top[0][0]} {top[0][1]:+.2f}% and "
        f"{top[1][0]} {top[1][1]:+.2f}%"
    )



def _build_risk_summary(*, alerts: list[dict[str, Any]], high_count: int, medium_count: int) -> str:
    if high_count > 0:
        keywords = _top_keyword_rules(alerts)
        if keywords:
            return f"elevated pressure around {', '.join(keywords)} and related conflict dynamics"
        return "elevated pressure from conflict, sanctions, and coup-related developments"

    if medium_count > 0:
        return "policy uncertainty tied to elections, protests, and strike activity"

    return "continuing geopolitical and market volatility across monitored regions"



def _top_keyword_rules(alerts: list[dict[str, Any]]) -> list[str]:
    counter: Counter[str] = Counter()
    for alert in alerts:
        rules = alert.get("matched_rules", [])
        if not isinstance(rules, list):
            continue
        for rule in rules:
            text = str(rule)
            if not text.startswith("keyword:"):
                continue
            keyword = text.split(":", 1)[1].strip()
            if keyword:
                counter[keyword] += 1

    ranked = sorted(counter.items(), key=lambda item: (-item[1], item[0]))
    return [keyword for keyword, _ in ranked[:2]]



def _normalize_topic(value: Any) -> str:
    key = str(value).strip().casefold()
    if not key:
        return "Unknown"
    return TOPIC_CANONICAL_MAP.get(key, str(value).strip().title())



def _parse_datetime(value: str) -> datetime | None:
    text = value.strip()
    if not text:
        return None

    for candidate in (text, text.replace("Z", "+00:00")):
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
