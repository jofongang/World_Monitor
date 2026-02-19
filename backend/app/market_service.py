"""
World Monitor market data service.

Fetches free market quotes from Stooq and serves cached snapshots for
market cards and multi-range history charts.
"""

from __future__ import annotations

import csv
import io
import logging
import os
import threading
import time
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

LOGGER = logging.getLogger(__name__)
USER_AGENT = "WorldMonitor/0.3 (+http://localhost)"
STOOQ_QUOTE_URL = "https://stooq.com/q/l/?s={symbol}&f=sd2t2ohlcv&e=csv"
STOOQ_DAILY_URL = "https://stooq.com/q/d/l/?s={symbol}&i=d&d1={start}&d2={end}"

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
    provider_symbol: str
    history_symbol: str | None = None


MARKET_SPECS: tuple[MarketSpec, ...] = (
    MarketSpec(symbol="SPX", name="S&P 500", provider_symbol="^spx"),
    MarketSpec(symbol="DJI", name="Dow Jones", provider_symbol="^dji"),
    MarketSpec(symbol="IXIC", name="NASDAQ", provider_symbol="^ndq"),
    MarketSpec(symbol="FTSE", name="FTSE 100", provider_symbol="^ukx"),
    MarketSpec(symbol="N225", name="Nikkei 225", provider_symbol="^nkx"),
    MarketSpec(symbol="BTC", name="Bitcoin", provider_symbol="btc.v"),
    # Stooq spot gold history is reliable; futures quote is used for live card.
    MarketSpec(symbol="GC", name="Gold", provider_symbol="gc.f", history_symbol="xauusd"),
    # Stooq crude futures lack daily-history endpoint; use USO proxy for trend line.
    MarketSpec(symbol="CL", name="Crude Oil", provider_symbol="cl.f", history_symbol="uso.us"),
)

FALLBACK_MARKETS: list[dict[str, Any]] = [
    {"symbol": "SPX", "name": "S&P 500", "price": 0.0, "change_pct": 0.0},
    {"symbol": "DJI", "name": "Dow Jones", "price": 0.0, "change_pct": 0.0},
    {"symbol": "IXIC", "name": "NASDAQ", "price": 0.0, "change_pct": 0.0},
    {"symbol": "FTSE", "name": "FTSE 100", "price": 0.0, "change_pct": 0.0},
    {"symbol": "N225", "name": "Nikkei 225", "price": 0.0, "change_pct": 0.0},
    {"symbol": "BTC", "name": "Bitcoin", "price": 0.0, "change_pct": 0.0},
    {"symbol": "GC", "name": "Gold", "price": 0.0, "change_pct": 0.0},
    {"symbol": "CL", "name": "Crude Oil", "price": 0.0, "change_pct": 0.0},
]


class MarketService:
    def __init__(self) -> None:
        self.refresh_interval_seconds = max(
            15, int(os.getenv("MARKET_REFRESH_SECONDS", "60"))
        )
        self.history_refresh_seconds = max(
            30, int(os.getenv("MARKET_HISTORY_REFRESH_SECONDS", "300"))
        )
        self.request_timeout_seconds = max(
            3.0, float(os.getenv("MARKET_FETCH_TIMEOUT_SECONDS", "8"))
        )
        self.history_days = max(3, int(os.getenv("MARKET_HISTORY_DAYS", "14")))

        self._state_lock = threading.Lock()
        self._refresh_lock = threading.Lock()
        self._cache: list[dict[str, Any]] = [dict(item) for item in FALLBACK_MARKETS]
        self._last_refresh_attempt = 0.0
        self._history_cache: dict[str, tuple[float, dict[str, Any]]] = {}

    def get_markets(self) -> dict[str, list[dict[str, Any]]]:
        self._refresh_if_stale()
        with self._state_lock:
            return {"items": [dict(item) for item in self._cache]}

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
            if not force and now - self._last_refresh_attempt < self.refresh_interval_seconds:
                return
            self._last_refresh_attempt = now

        if force:
            acquired = self._refresh_lock.acquire(timeout=self.request_timeout_seconds * 10)
        else:
            acquired = self._refresh_lock.acquire(blocking=False)
        if not acquired:
            return

        try:
            items = self._fetch_all_markets()
            if items:
                with self._state_lock:
                    self._cache = items
        except Exception:
            LOGGER.exception("Market refresh failed. Serving last cached snapshot.")
        finally:
            self._refresh_lock.release()

    def _refresh_if_stale(self) -> None:
        now = time.time()
        with self._state_lock:
            stale = now - self._last_refresh_attempt >= self.refresh_interval_seconds
        if stale:
            self.refresh(force=False)

    def _fetch_all_markets(self) -> list[dict[str, Any]]:
        with self._state_lock:
            cached_by_symbol = {item["symbol"]: dict(item) for item in self._cache}

        items: list[dict[str, Any]] = []
        for spec in MARKET_SPECS:
            try:
                price, change_pct = self._fetch_market_snapshot(spec.provider_symbol)
                items.append(
                    {
                        "symbol": spec.symbol,
                        "name": spec.name,
                        "price": round(price, 2),
                        "change_pct": round(change_pct, 2),
                    }
                )
            except Exception as exc:
                LOGGER.warning(
                    "Market fetch failed for %s (%s): %s",
                    spec.symbol,
                    spec.provider_symbol,
                    exc,
                )
                fallback = cached_by_symbol.get(
                    spec.symbol,
                    {
                        "symbol": spec.symbol,
                        "name": spec.name,
                        "price": 0.0,
                        "change_pct": 0.0,
                    },
                )
                fallback["name"] = spec.name
                items.append(fallback)
        return items

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
        symbols_to_try = [spec.history_symbol, spec.provider_symbol]
        rows: list[dict[str, str]] = []

        for symbol in symbols_to_try:
            if not symbol:
                continue
            try:
                rows = self._fetch_daily_rows_for_symbol(symbol, start_date, end_date)
            except Exception as exc:
                LOGGER.debug(
                    "History fetch failed for %s via %s: %s",
                    spec.symbol,
                    symbol,
                    exc,
                )
                rows = []
            if rows:
                break

        if range_key == "24h" and len(rows) > 2:
            rows = rows[-2:]

        points: list[dict[str, Any]] = []
        for row in rows:
            close_price = _parse_float(row.get("Close"))
            if close_price is None:
                continue
            timestamp = row.get("Date", "").strip()
            if not timestamp:
                continue
            points.append(
                {
                    "timestamp": timestamp,
                    "price": round(close_price, 4),
                }
            )

        if not points:
            quote_point = self._fetch_quote_point(spec.provider_symbol)
            if quote_point:
                points = [quote_point]

        return _downsample_points(points, MAX_HISTORY_POINTS)

    def _fetch_market_snapshot(self, provider_symbol: str) -> tuple[float, float]:
        try:
            return self._fetch_from_daily_series(provider_symbol)
        except (HTTPError, URLError, TimeoutError, ValueError):
            return self._fetch_from_quote(provider_symbol)

    def _fetch_daily_rows_for_symbol(
        self, provider_symbol: str, start_date: date, end_date: date
    ) -> list[dict[str, str]]:
        url = STOOQ_DAILY_URL.format(
            symbol=quote(provider_symbol),
            start=start_date.strftime("%Y%m%d"),
            end=end_date.strftime("%Y%m%d"),
        )
        csv_text = self._download_text(url)
        return _parse_daily_rows(csv_text)

    def _fetch_from_daily_series(self, provider_symbol: str) -> tuple[float, float]:
        end_date = date.today()
        start_date = end_date - timedelta(days=self.history_days)
        rows = self._fetch_daily_rows_for_symbol(provider_symbol, start_date, end_date)
        if not rows:
            raise ValueError(f"No daily rows for symbol {provider_symbol}")

        latest = rows[-1]
        latest_close = _parse_float(latest.get("Close"))
        if latest_close is None:
            raise ValueError(f"Missing close for symbol {provider_symbol}")

        previous_close = None
        if len(rows) >= 2:
            previous_close = _parse_float(rows[-2].get("Close"))
        open_price = _parse_float(latest.get("Open"))
        change_pct = _compute_change_pct(latest_close, previous_close, open_price)
        return latest_close, change_pct

    def _fetch_from_quote(self, provider_symbol: str) -> tuple[float, float]:
        row = self._fetch_quote_row(provider_symbol)
        if row is None:
            raise ValueError(f"No quote row for symbol {provider_symbol}")

        close_price = _parse_float(row[6] if len(row) > 6 else None)
        if close_price is None:
            raise ValueError(f"Missing quote close for symbol {provider_symbol}")
        open_price = _parse_float(row[3] if len(row) > 3 else None)
        change_pct = _compute_change_pct(close_price, previous_close=None, open_price=open_price)
        return close_price, change_pct

    def _fetch_quote_point(self, provider_symbol: str) -> dict[str, Any] | None:
        row = self._fetch_quote_row(provider_symbol)
        if row is None:
            return None

        close_price = _parse_float(row[6] if len(row) > 6 else None)
        if close_price is None:
            return None

        quote_date = (row[1] if len(row) > 1 else "").strip()
        quote_time = (row[2] if len(row) > 2 else "").strip()
        if quote_date and quote_time and quote_time.upper() != "N/D":
            timestamp = f"{quote_date}T{quote_time}"
        elif quote_date:
            timestamp = quote_date
        else:
            timestamp = date.today().isoformat()

        return {
            "timestamp": timestamp,
            "price": round(close_price, 4),
        }

    def _fetch_quote_row(self, provider_symbol: str) -> list[str] | None:
        url = STOOQ_QUOTE_URL.format(symbol=quote(provider_symbol))
        csv_text = self._download_text(url)
        return _parse_quote_row(csv_text)

    def _download_text(self, url: str) -> str:
        request = Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/csv, text/plain;q=0.9, */*;q=0.8",
                "Accept-Encoding": "identity",
            },
        )
        with urlopen(request, timeout=self.request_timeout_seconds) as response:
            return response.read().decode("utf-8", errors="replace")


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


def _parse_daily_rows(csv_text: str) -> list[dict[str, str]]:
    stream = io.StringIO(csv_text)
    reader = csv.DictReader(stream)
    rows: list[dict[str, str]] = []
    for raw_row in reader:
        row: dict[str, str] = {}
        for key, value in raw_row.items():
            normalized_key = (key or "").lstrip("\ufeff")
            row[normalized_key] = (value or "").strip()
        if not row.get("Date"):
            continue
        if _parse_float(row.get("Close")) is None:
            continue
        rows.append(row)
    return rows


def _parse_quote_row(csv_text: str) -> list[str] | None:
    stream = io.StringIO(csv_text)
    reader = csv.reader(stream)
    rows: list[list[str]] = []
    for row in reader:
        cleaned = [column.strip() for column in row]
        if not any(cleaned):
            continue
        rows.append(cleaned)

    if not rows:
        return None

    first = rows[0]
    if first and first[0].lower() == "symbol":
        return rows[1] if len(rows) >= 2 else None
    return first


def _parse_float(value: str | None) -> float | None:
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned or cleaned.upper() in {"N/D", "NULL", "-"}:
        return None
    try:
        return float(cleaned.replace(",", ""))
    except ValueError:
        return None


def _compute_change_pct(
    current_price: float, previous_close: float | None, open_price: float | None
) -> float:
    baseline = previous_close if previous_close and previous_close > 0 else open_price
    if baseline is None or baseline <= 0:
        return 0.0
    return ((current_price - baseline) / baseline) * 100.0
