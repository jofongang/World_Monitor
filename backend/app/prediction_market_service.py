"""Prediction market aggregation service (Polymarket + Kalshi)."""

from __future__ import annotations

import json
import logging
import os
import ssl
import threading
import time
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

LOGGER = logging.getLogger(__name__)
USER_AGENT = "WorldMonitor/0.8 (+http://localhost)"


class PredictionMarketService:
    def __init__(self) -> None:
        self.cache_seconds = max(30, int(os.getenv("PREDICTION_CACHE_SECONDS", "120")))
        self.request_timeout_seconds = max(
            3.0, float(os.getenv("PREDICTION_FETCH_TIMEOUT_SECONDS", "12"))
        )
        self.max_items_per_source = max(10, int(os.getenv("PREDICTION_MAX_ITEMS_PER_SOURCE", "80")))

        self.polymarket_url = os.getenv(
            "POLYMARKET_API_URL",
            "https://gamma-api.polymarket.com/markets?closed=false&limit=80",
        )
        self.kalshi_url = os.getenv(
            "KALSHI_API_URL",
            "https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=80",
        )

        self._ssl_context = ssl.create_default_context()
        self._state_lock = threading.Lock()
        self._refresh_lock = threading.Lock()
        self._cache: list[dict[str, Any]] = []
        self._sources: list[dict[str, Any]] = [
            {"name": "Polymarket", "ok": False, "fetched": 0, "last_error": "not yet fetched"},
            {"name": "Kalshi", "ok": False, "fetched": 0, "last_error": "not yet fetched"},
        ]
        self._last_updated: str | None = None
        self._cached_at = 0.0

    def get_markets(self, force_refresh: bool = False) -> dict[str, Any]:
        if force_refresh:
            self.refresh(force=True)
        else:
            self._refresh_if_stale()

        with self._state_lock:
            return {
                "items": [dict(item) for item in self._cache],
                "sources": [dict(source) for source in self._sources],
                "last_updated": self._last_updated,
            }

    def refresh_async(self, force: bool = False) -> None:
        if self._refresh_lock.locked():
            return
        thread = threading.Thread(
            target=self.refresh,
            kwargs={"force": force},
            daemon=True,
        )
        thread.start()

    def refresh(self, force: bool = False) -> None:
        now = time.time()
        with self._state_lock:
            cache_valid = now - self._cached_at < self.cache_seconds
            if cache_valid and not force:
                return

        acquired = self._refresh_lock.acquire(timeout=self.request_timeout_seconds * 2)
        if not acquired:
            return

        try:
            now = time.time()
            with self._state_lock:
                cache_valid = now - self._cached_at < self.cache_seconds
                if cache_valid and not force:
                    return

            aggregated: list[dict[str, Any]] = []
            source_rows: list[dict[str, Any]] = []

            poly_items, poly_error = self._fetch_polymarket()
            aggregated.extend(poly_items)
            source_rows.append(
                {
                    "name": "Polymarket",
                    "ok": poly_error is None,
                    "fetched": len(poly_items),
                    "last_error": poly_error,
                }
            )

            kalshi_items, kalshi_error = self._fetch_kalshi()
            aggregated.extend(kalshi_items)
            source_rows.append(
                {
                    "name": "Kalshi",
                    "ok": kalshi_error is None,
                    "fetched": len(kalshi_items),
                    "last_error": kalshi_error,
                }
            )

            aggregated.sort(
                key=lambda item: (
                    _to_float(item.get("volume_24h")) or 0.0,
                    _to_float(item.get("volume_total")) or 0.0,
                    str(item.get("title", "")),
                ),
                reverse=True,
            )

            with self._state_lock:
                if aggregated:
                    self._cache = aggregated
                    self._last_updated = _utc_now_iso()
                    self._cached_at = time.time()
                elif not self._cache:
                    self._cache = []
                    self._last_updated = _utc_now_iso()
                    self._cached_at = time.time()
                self._sources = source_rows
        except Exception:
            LOGGER.exception("Prediction market refresh failed.")
        finally:
            self._refresh_lock.release()

    def _refresh_if_stale(self) -> None:
        now = time.time()
        with self._state_lock:
            stale = now - self._cached_at >= self.cache_seconds
            empty = not self._cache
        if stale or empty:
            self.refresh_async(force=False)

    def _fetch_polymarket(self) -> tuple[list[dict[str, Any]], str | None]:
        try:
            payload = self._download_json(self.polymarket_url)
            if not isinstance(payload, list):
                return [], "Unexpected Polymarket payload"

            output: list[dict[str, Any]] = []
            for raw in payload[: self.max_items_per_source]:
                if not isinstance(raw, dict):
                    continue
                if raw.get("closed") is True:
                    continue

                outcomes = _as_list(raw.get("outcomes"))
                outcome_prices = _as_list(raw.get("outcomePrices"))
                yes_price, no_price = _extract_binary_prices(outcomes, outcome_prices)

                best_bid = _to_float(raw.get("bestBid"))
                best_ask = _to_float(raw.get("bestAsk"))
                if yes_price is None and best_bid is not None and 0.0 <= best_bid <= 1.0:
                    yes_price = best_bid * 100.0
                    no_price = 100.0 - yes_price
                elif yes_price is None and best_ask is not None and 0.0 <= best_ask <= 1.0:
                    yes_price = best_ask * 100.0
                    no_price = 100.0 - yes_price

                last_price_raw = _to_float(raw.get("lastTradePrice"))
                last_price = (
                    last_price_raw * 100.0
                    if last_price_raw is not None and 0.0 <= last_price_raw <= 1.0
                    else None
                )

                slug = str(raw.get("slug", "")).strip()
                url = str(raw.get("url", "")).strip() or (
                    f"https://polymarket.com/event/{slug}" if slug else ""
                )

                title = str(raw.get("question", "")).strip()
                if not title:
                    continue

                market_id = str(raw.get("id", "")).strip() or slug or title
                status = "active" if bool(raw.get("active", False)) else "inactive"

                output.append(
                    {
                        "id": f"polymarket:{market_id}",
                        "provider": "Polymarket",
                        "ticker": slug or market_id,
                        "title": title,
                        "subtitle": str(raw.get("category", "")).strip() or None,
                        "url": url or None,
                        "status": status,
                        "yes_price": _round2(yes_price),
                        "no_price": _round2(no_price),
                        "last_price": _round2(last_price),
                        "volume_24h": _round2(_to_float(raw.get("volume24hr"))),
                        "volume_total": _round2(_to_float(raw.get("volume"))),
                        "liquidity": _round2(_to_float(raw.get("liquidity"))),
                        "open_interest": _round2(_to_float(raw.get("openInterest"))),
                        "close_time": _first_text(
                            raw,
                            ["endDateIso", "endDate", "closedTime"],
                        ),
                        "updated_at": _first_text(raw, ["updatedAt", "createdAt"]) or _utc_now_iso(),
                    }
                )

            return output, None
        except (HTTPError, URLError, TimeoutError) as exc:
            LOGGER.warning("Polymarket fetch failed: %s", exc)
            return [], str(exc)
        except Exception as exc:
            LOGGER.warning("Polymarket parse failed: %s", exc)
            return [], str(exc)

    def _fetch_kalshi(self) -> tuple[list[dict[str, Any]], str | None]:
        try:
            payload = self._download_json(self.kalshi_url)
            if not isinstance(payload, dict):
                return [], "Unexpected Kalshi payload"

            markets = payload.get("markets", [])
            if not isinstance(markets, list):
                return [], "Missing Kalshi markets list"

            output: list[dict[str, Any]] = []
            for raw in markets[: self.max_items_per_source]:
                if not isinstance(raw, dict):
                    continue

                status = str(raw.get("status", "")).strip().lower() or "unknown"
                if status not in {"active", "open", "initialized"}:
                    continue

                title = str(raw.get("title", "")).strip()
                if not title:
                    continue

                ticker = str(raw.get("ticker", "")).strip()
                yes_bid = _to_float(raw.get("yes_bid_dollars"))
                yes_ask = _to_float(raw.get("yes_ask_dollars"))
                no_bid = _to_float(raw.get("no_bid_dollars"))
                no_ask = _to_float(raw.get("no_ask_dollars"))

                yes_price = _midpoint(yes_bid, yes_ask)
                no_price = _midpoint(no_bid, no_ask)

                last_price_raw = _to_float(raw.get("last_price_dollars"))
                if last_price_raw is None:
                    last_price_raw = _to_float(raw.get("last_price"))
                    if last_price_raw is not None and last_price_raw > 1.0:
                        last_price_raw = last_price_raw / 100.0

                output.append(
                    {
                        "id": f"kalshi:{ticker or title}",
                        "provider": "Kalshi",
                        "ticker": ticker or None,
                        "title": title,
                        "subtitle": str(raw.get("subtitle", "")).strip() or None,
                        "url": f"https://kalshi.com/markets/{ticker}" if ticker else None,
                        "status": status,
                        "yes_price": _as_percent(yes_price),
                        "no_price": _as_percent(no_price),
                        "last_price": _as_percent(last_price_raw),
                        "volume_24h": _round2(_to_float(raw.get("volume_24h"))),
                        "volume_total": _round2(_to_float(raw.get("volume"))),
                        "liquidity": _round2(
                            _to_float(raw.get("liquidity_dollars"))
                            if raw.get("liquidity_dollars") is not None
                            else _to_float(raw.get("liquidity"))
                        ),
                        "open_interest": _round2(_to_float(raw.get("open_interest"))),
                        "close_time": _first_text(raw, ["close_time", "expiration_time"]),
                        "updated_at": _first_text(raw, ["updated_time", "created_time"]) or _utc_now_iso(),
                    }
                )

            return output, None
        except (HTTPError, URLError, TimeoutError) as exc:
            LOGGER.warning("Kalshi fetch failed: %s", exc)
            return [], str(exc)
        except Exception as exc:
            LOGGER.warning("Kalshi parse failed: %s", exc)
            return [], str(exc)

    def _download_json(self, url: str) -> Any:
        request = Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
                "Accept-Encoding": "identity",
            },
        )
        with urlopen(
            request,
            timeout=self.request_timeout_seconds,
            context=self._ssl_context,
        ) as response:
            raw = response.read().decode("utf-8", errors="replace")
        return json.loads(raw)


def _as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        try:
            decoded = json.loads(text)
            return decoded if isinstance(decoded, list) else []
        except json.JSONDecodeError:
            return []
    return []


def _extract_binary_prices(
    outcomes: list[Any],
    outcome_prices: list[Any],
) -> tuple[float | None, float | None]:
    yes_price: float | None = None
    no_price: float | None = None
    pairs = zip(outcomes, outcome_prices)

    for outcome_raw, price_raw in pairs:
        outcome = str(outcome_raw).strip().lower()
        price = _to_float(price_raw)
        if price is None:
            continue
        if 0.0 <= price <= 1.0:
            price *= 100.0
        if "yes" in outcome:
            yes_price = price
        elif "no" in outcome:
            no_price = price

    if yes_price is not None and no_price is None and 0.0 <= yes_price <= 100.0:
        no_price = 100.0 - yes_price
    if no_price is not None and yes_price is None and 0.0 <= no_price <= 100.0:
        yes_price = 100.0 - no_price

    return yes_price, no_price


def _midpoint(a: float | None, b: float | None) -> float | None:
    if a is not None and b is not None:
        return (a + b) / 2.0
    if a is not None:
        return a
    if b is not None:
        return b
    return None


def _as_percent(value: float | None) -> float | None:
    if value is None:
        return None
    if 0.0 <= value <= 1.0:
        return _round2(value * 100.0)
    if 0.0 <= value <= 100.0:
        return _round2(value)
    return _round2(value)


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _round2(value: float | None) -> float | None:
    if value is None:
        return None
    return round(value, 2)


def _first_text(payload: dict[str, Any], keys: list[str]) -> str | None:
    for key in keys:
        value = payload.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )
