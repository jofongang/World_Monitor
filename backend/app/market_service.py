"""World Monitor market data service with provider guardrails."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from app.providers.coingecko_provider import CoinGeckoProvider
from app.providers.common import ProviderQuote, parse_float, utc_now_iso
from app.providers.stooq_provider import StooqProvider

DEFAULT_HISTORY_RANGE = "1m"
HISTORY_RANGE_DAYS: dict[str, int] = {
    "24h": 2,
    "7d": 10,
    "1m": 35,
    "6m": 220,
    "1y": 400,
    "5y": 2000,
}
MAX_HISTORY_POINTS = 420


@dataclass(frozen=True)
class MarketSpec:
    symbol: str
    name: str
    provider: str
    provider_symbol: str
    history_symbol: str | None = None


MARKET_SPECS: tuple[MarketSpec, ...] = (
    MarketSpec(
        symbol="SPY",
        name="S&P 500 (SPY)",
        provider="stooq",
        provider_symbol="spy.us",
    ),
    MarketSpec(
        symbol="DIA",
        name="Dow Jones (DIA)",
        provider="stooq",
        provider_symbol="dia.us",
    ),
    MarketSpec(
        symbol="QQQ",
        name="NASDAQ 100 (QQQ)",
        provider="stooq",
        provider_symbol="qqq.us",
    ),
    MarketSpec(
        symbol="EWU",
        name="FTSE UK (EWU)",
        provider="stooq",
        provider_symbol="ewu.us",
    ),
    MarketSpec(
        symbol="EWJ",
        name="Nikkei Japan (EWJ)",
        provider="stooq",
        provider_symbol="ewj.us",
    ),
    MarketSpec(
        symbol="GLD",
        name="Gold (GLD)",
        provider="stooq",
        provider_symbol="gld.us",
    ),
    MarketSpec(
        symbol="USO",
        name="Crude Oil (USO)",
        provider="stooq",
        provider_symbol="uso.us",
    ),
    MarketSpec(
        symbol="BTC",
        name="Bitcoin (BTC)",
        provider="coingecko",
        provider_symbol="bitcoin",
        history_symbol="btc.v",
    ),
)


class MarketService:
    def __init__(self) -> None:
        self.cache_seconds = 60
        self.history_refresh_seconds = 300
        self.request_timeout_seconds = 8.0

        self.stooq = StooqProvider(timeout_seconds=self.request_timeout_seconds)
        self.coingecko = CoinGeckoProvider(timeout_seconds=self.request_timeout_seconds)

        self._state_lock = threading.Lock()
        self._refresh_lock = threading.Lock()
        self._markets_cache: list[dict[str, Any]] = []
        self._markets_cached_at = 0.0
        self._history_cache: dict[str, tuple[float, dict[str, Any]]] = {}

    def get_markets(self) -> list[dict[str, Any]]:
        self._refresh_if_stale()
        with self._state_lock:
            return [dict(item) for item in self._markets_cache]

    def get_provider_health(self) -> dict[str, dict[str, object]]:
        return {
            self.stooq.name: self.stooq.health(),
            self.coingecko.name: self.coingecko.health(),
        }

    def get_market_history(self, range_key: str) -> dict[str, Any]:
        normalized_range = _normalize_history_range(range_key)
        now = time.time()

        with self._state_lock:
            cached = self._history_cache.get(normalized_range)
            if cached and now - cached[0] < self.history_refresh_seconds:
                return _copy_history_payload(cached[1])

        payload = self._fetch_market_history(normalized_range)
        with self._state_lock:
            self._history_cache[normalized_range] = (time.time(), payload)

        return _copy_history_payload(payload)

    def refresh(self, force: bool = False) -> None:
        now = time.time()
        with self._state_lock:
            cache_valid = now - self._markets_cached_at < self.cache_seconds
            if cache_valid and not force:
                return

        acquired = self._refresh_lock.acquire(blocking=False)
        if not acquired:
            return

        try:
            now = time.time()
            with self._state_lock:
                cache_valid = now - self._markets_cached_at < self.cache_seconds
                if cache_valid and not force:
                    return

            items = self._fetch_live_markets()
            with self._state_lock:
                self._markets_cache = items
                self._markets_cached_at = time.time()
        finally:
            self._refresh_lock.release()

    def _refresh_if_stale(self) -> None:
        now = time.time()
        with self._state_lock:
            stale = now - self._markets_cached_at >= self.cache_seconds
            empty = not self._markets_cache
        if stale or empty:
            self.refresh(force=False)

    def _fetch_live_markets(self) -> list[dict[str, Any]]:
        fetch_iso = utc_now_iso()
        coingecko_ids = [
            spec.provider_symbol for spec in MARKET_SPECS if spec.provider == "coingecko"
        ]
        coingecko_quotes = self.coingecko.fetch_prices(coingecko_ids)

        items: list[dict[str, Any]] = []
        for spec in MARKET_SPECS:
            quote = self._fetch_spec_quote(spec, coingecko_quotes)
            items.append(
                {
                    "symbol": spec.symbol,
                    "name": spec.name,
                    "price": round(quote.price, 4) if quote.price is not None else None,
                    "change_pct": round(quote.change_pct, 4)
                    if quote.change_pct is not None
                    else None,
                    "as_of": quote.as_of or fetch_iso,
                    "provider": spec.provider,
                    "error": quote.error,
                }
            )

        return items

    def _fetch_spec_quote(
        self, spec: MarketSpec, coingecko_quotes: dict[str, ProviderQuote]
    ) -> ProviderQuote:
        if spec.provider == "stooq":
            return self.stooq.fetch_quote(spec.provider_symbol)

        if spec.provider == "coingecko":
            quote = coingecko_quotes.get(spec.provider_symbol)
            if quote is None:
                return ProviderQuote(
                    price=None,
                    change_pct=None,
                    as_of=utc_now_iso(),
                    error=f"Missing quote for {spec.provider_symbol}",
                )
            return quote

        return ProviderQuote(
            price=None,
            change_pct=None,
            as_of=utc_now_iso(),
            error=f"Unsupported provider: {spec.provider}",
        )

    def _fetch_market_history(self, range_key: str) -> dict[str, Any]:
        days = HISTORY_RANGE_DAYS[range_key]
        end_date = date.today()
        start_date = end_date - timedelta(days=days)

        series_payload: list[dict[str, Any]] = []
        for spec in MARKET_SPECS:
            points = self._fetch_history_points(spec, range_key, start_date, end_date)
            series_payload.append(
                {
                    "symbol": spec.symbol,
                    "name": spec.name,
                    "points": points,
                }
            )

        return {
            "range": range_key,
            "series": series_payload,
        }

    def _fetch_history_points(
        self, spec: MarketSpec, range_key: str, start_date: date, end_date: date
    ) -> list[dict[str, Any]]:
        history_symbol = spec.history_symbol
        if history_symbol is None and spec.provider == "stooq":
            history_symbol = spec.provider_symbol

        rows: list[dict[str, str]] = []
        if history_symbol:
            try:
                rows = self.stooq.fetch_daily_rows(
                    symbol=history_symbol,
                    start_date=start_date,
                    end_date=end_date,
                )
            except Exception:
                rows = []

        if range_key == "24h" and len(rows) > 2:
            rows = rows[-2:]

        points: list[dict[str, Any]] = []
        for row in rows:
            close_price = parse_float(row.get("Close"))
            if close_price is None:
                continue

            timestamp = (row.get("Date") or "").strip()
            if not timestamp:
                continue

            points.append(
                {
                    "timestamp": timestamp,
                    "price": round(close_price, 4),
                }
            )

        if not points:
            fallback_symbol = history_symbol or spec.provider_symbol
            quote = self.stooq.fetch_quote(fallback_symbol)
            if quote.price is not None:
                timestamp = quote.as_of or utc_now_iso()
                points = [
                    {
                        "timestamp": timestamp,
                        "price": round(quote.price, 4),
                    }
                ]

        return _downsample_points(points, MAX_HISTORY_POINTS)


def _normalize_history_range(range_key: str) -> str:
    candidate = (range_key or "").strip().lower()
    if candidate not in HISTORY_RANGE_DAYS:
        return DEFAULT_HISTORY_RANGE
    return candidate


def _copy_history_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "range": payload.get("range", DEFAULT_HISTORY_RANGE),
        "series": [
            {
                "symbol": str(series.get("symbol", "")),
                "name": str(series.get("name", "")),
                "points": [
                    {
                        "timestamp": str(point.get("timestamp", "")),
                        "price": float(point.get("price", 0.0)),
                    }
                    for point in series.get("points", [])
                ],
            }
            for series in payload.get("series", [])
        ],
    }


def _downsample_points(points: list[dict[str, Any]], max_points: int) -> list[dict[str, Any]]:
    if len(points) <= max_points:
        return points
    if max_points <= 2:
        return [points[0], points[-1]]

    step = (len(points) - 1) / (max_points - 1)
    sampled: list[dict[str, Any]] = []
    for index in range(max_points):
        source_index = round(index * step)
        sampled.append(points[source_index])
    return sampled
