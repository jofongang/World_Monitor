"""CoinGecko provider adapter for crypto assets."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.providers.common import ProviderHealth, ProviderQuote, parse_float, utc_now_iso

COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price"
COINGECKO_USER_AGENT = "WorldMonitor/0.4 (+http://localhost)"


class CoinGeckoProvider:
    name = "coingecko"

    def __init__(self, timeout_seconds: float) -> None:
        self.timeout_seconds = timeout_seconds
        self._health = ProviderHealth()

    def fetch_prices(self, coin_ids: list[str]) -> dict[str, ProviderQuote]:
        if not coin_ids:
            return {}

        try:
            payload = self._request_payload(coin_ids)
            self._record_success()
            return {
                coin_id: self._parse_coin_payload(coin_id, payload.get(coin_id))
                for coin_id in coin_ids
            }
        except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
            message = f"{type(exc).__name__}: {exc}"
            self._record_error(message)
            return {
                coin_id: ProviderQuote(
                    price=None,
                    change_pct=None,
                    as_of=utc_now_iso(),
                    error=message,
                )
                for coin_id in coin_ids
            }

    def health(self) -> dict[str, object]:
        return {
            "ok": self._health.ok,
            "last_success_at": self._health.last_success_at,
            "last_error": self._health.last_error,
        }

    def _request_payload(self, coin_ids: list[str]) -> dict[str, object]:
        params = urlencode(
            {
                "ids": ",".join(coin_ids),
                "vs_currencies": "usd",
                "include_24hr_change": "true",
                "include_last_updated_at": "true",
            }
        )
        url = f"{COINGECKO_URL}?{params}"
        request = Request(
            url,
            headers={
                "User-Agent": COINGECKO_USER_AGENT,
                "Accept": "application/json",
            },
        )
        with urlopen(request, timeout=self.timeout_seconds) as response:
            raw = response.read().decode("utf-8", errors="replace")

        payload = json.loads(raw)
        if not isinstance(payload, dict):
            raise ValueError("Unexpected payload shape")
        return payload

    def _parse_coin_payload(self, coin_id: str, payload: object) -> ProviderQuote:
        if not isinstance(payload, dict):
            return ProviderQuote(
                price=None,
                change_pct=None,
                as_of=utc_now_iso(),
                error=f"Missing coin in response: {coin_id}",
            )

        price = parse_float(payload.get("usd"))
        change_pct = parse_float(payload.get("usd_24h_change"))
        updated_at = payload.get("last_updated_at")
        as_of = _epoch_to_iso(updated_at) or utc_now_iso()

        if price is None:
            return ProviderQuote(
                price=None,
                change_pct=None,
                as_of=as_of,
                error=f"Missing usd price for {coin_id}",
            )

        return ProviderQuote(
            price=price,
            change_pct=change_pct,
            as_of=as_of,
            error=None,
        )

    def _record_success(self) -> None:
        self._health.ok = True
        self._health.last_success_at = utc_now_iso()
        self._health.last_error = None

    def _record_error(self, message: str) -> None:
        self._health.ok = False
        self._health.last_error = message


def _epoch_to_iso(value: object) -> str | None:
    if not isinstance(value, (int, float)):
        return None
    try:
        dt = datetime.fromtimestamp(float(value), tz=timezone.utc)
    except (ValueError, OSError, OverflowError):
        return None
    return dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")
