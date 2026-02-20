"""Common provider helpers and response models."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass(frozen=True)
class ProviderQuote:
    price: float | None
    change_pct: float | None
    as_of: str | None
    error: str | None = None


@dataclass
class ProviderHealth:
    ok: bool = False
    last_success_at: str | None = None
    last_error: str | None = None


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )


def normalize_iso(date_value: str | None, time_value: str | None = None) -> str | None:
    if not date_value:
        return None

    date_text = date_value.strip()
    if not date_text or date_text.upper() == "N/D":
        return None

    if time_value and time_value.strip() and time_value.strip().upper() != "N/D":
        joined = f"{date_text}T{time_value.strip()}"
    else:
        joined = date_text

    try:
        parsed = datetime.fromisoformat(joined)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )


def parse_float(value: str | int | float | None) -> float | None:
    if value is None:
        return None

    if isinstance(value, (int, float)):
        return float(value)

    cleaned = str(value).strip()
    if not cleaned or cleaned.upper() in {"N/D", "NULL", "-"}:
        return None

    try:
        return float(cleaned.replace(",", ""))
    except ValueError:
        return None
