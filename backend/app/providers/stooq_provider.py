"""Stooq provider adapter for ETFs/stocks/commodities."""

from __future__ import annotations

import csv
import io
from datetime import date
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from app.providers.common import ProviderHealth, ProviderQuote, normalize_iso, parse_float, utc_now_iso

STOOQ_QUOTE_URL = "https://stooq.com/q/l/?s={symbol}&f=sd2t2ohlcv&e=csv"
STOOQ_DAILY_URL = "https://stooq.com/q/d/l/?s={symbol}&i=d&d1={start}&d2={end}"
STOOQ_USER_AGENT = "WorldMonitor/0.4 (+http://localhost)"


class StooqProvider:
    name = "stooq"

    def __init__(self, timeout_seconds: float) -> None:
        self.timeout_seconds = timeout_seconds
        self._health = ProviderHealth()

    def fetch_quote(self, symbol: str) -> ProviderQuote:
        try:
            url = STOOQ_QUOTE_URL.format(symbol=quote(symbol))
            csv_text = self._download_text(url)
            row = _parse_quote_row(csv_text)
            if row is None:
                raise ValueError("No quote row")

            close_price = parse_float(row[6] if len(row) > 6 else None)
            if close_price is None:
                raise ValueError("Missing close")

            open_price = parse_float(row[3] if len(row) > 3 else None)
            change_pct = _compute_change_pct(close_price, open_price)
            as_of = normalize_iso(
                row[1] if len(row) > 1 else None,
                row[2] if len(row) > 2 else None,
            ) or utc_now_iso()
            self._record_success()
            return ProviderQuote(
                price=close_price,
                change_pct=change_pct,
                as_of=as_of,
                error=None,
            )
        except (HTTPError, URLError, TimeoutError, ValueError) as exc:
            message = f"{type(exc).__name__}: {exc}"
            self._record_error(message)
            return ProviderQuote(
                price=None,
                change_pct=None,
                as_of=utc_now_iso(),
                error=message,
            )

    def fetch_daily_rows(
        self, symbol: str, start_date: date, end_date: date
    ) -> list[dict[str, str]]:
        url = STOOQ_DAILY_URL.format(
            symbol=quote(symbol),
            start=start_date.strftime("%Y%m%d"),
            end=end_date.strftime("%Y%m%d"),
        )
        csv_text = self._download_text(url)
        rows = _parse_daily_rows(csv_text)
        if not rows:
            raise ValueError(f"No daily rows for {symbol}")

        self._record_success()
        return rows

    def health(self) -> dict[str, object]:
        return {
            "ok": self._health.ok,
            "last_success_at": self._health.last_success_at,
            "last_error": self._health.last_error,
        }

    def _record_success(self) -> None:
        self._health.ok = True
        self._health.last_success_at = utc_now_iso()
        self._health.last_error = None

    def _record_error(self, message: str) -> None:
        self._health.ok = False
        self._health.last_error = message

    def _download_text(self, url: str) -> str:
        request = Request(
            url,
            headers={
                "User-Agent": STOOQ_USER_AGENT,
                "Accept": "text/csv, text/plain;q=0.9, */*;q=0.8",
                "Accept-Encoding": "identity",
            },
        )
        with urlopen(request, timeout=self.timeout_seconds) as response:
            return response.read().decode("utf-8", errors="replace")


def _parse_quote_row(csv_text: str) -> list[str] | None:
    reader = csv.reader(io.StringIO(csv_text))
    rows: list[list[str]] = []
    for row in reader:
        cleaned = [cell.strip() for cell in row]
        if any(cleaned):
            rows.append(cleaned)

    if not rows:
        return None

    first = rows[0]
    if first and first[0].lower() == "symbol":
        return rows[1] if len(rows) > 1 else None
    return first


def _parse_daily_rows(csv_text: str) -> list[dict[str, str]]:
    reader = csv.DictReader(io.StringIO(csv_text))
    rows: list[dict[str, str]] = []

    for raw_row in reader:
        row: dict[str, str] = {}
        for key, value in raw_row.items():
            normalized_key = (key or "").lstrip("\ufeff")
            row[normalized_key] = (value or "").strip()

        if not row.get("Date"):
            continue
        if parse_float(row.get("Close")) is None:
            continue
        rows.append(row)

    return rows


def _compute_change_pct(price: float, open_price: float | None) -> float | None:
    if open_price is None or open_price <= 0:
        return None
    return ((price - open_price) / open_price) * 100.0
