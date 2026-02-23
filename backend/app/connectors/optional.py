"""Optional key-based connectors (stubs enabled via feature flags)."""

from __future__ import annotations

import os
import time

from app.connectors.base import ConnectorResult
from app.domain.models import WorldEvent


class AcledConnector:
    name = "ACLED"

    def __init__(self) -> None:
        self.api_key = os.getenv("ACLED_API_KEY", "").strip()
        self.email = os.getenv("ACLED_EMAIL", "").strip()

    @property
    def enabled(self) -> bool:
        return bool(self.api_key and self.email)

    def fetch(self, *, since_hours: int = 48) -> ConnectorResult:
        started = time.perf_counter()
        if not self.enabled:
            return ConnectorResult(
                name=self.name,
                events=[],
                error="disabled (missing ACLED_API_KEY or ACLED_EMAIL)",
                duration_ms=int((time.perf_counter() - started) * 1000),
            )
        # Full keyed connector path can be added without changing ingestion orchestration.
        return ConnectorResult(
            name=self.name,
            events=[],
            error="enabled but not configured for this environment",
            duration_ms=int((time.perf_counter() - started) * 1000),
        )


class MarketOverlayConnector:
    name = "Market Overlay"

    def __init__(self) -> None:
        self.alpha_vantage_key = os.getenv("ALPHA_VANTAGE_API_KEY", "").strip()

    @property
    def enabled(self) -> bool:
        return bool(self.alpha_vantage_key)

    def fetch(self, *, since_hours: int = 48) -> ConnectorResult:
        started = time.perf_counter()
        events: list[WorldEvent] = []
        if not self.enabled:
            return ConnectorResult(
                name=self.name,
                events=events,
                error="disabled (missing ALPHA_VANTAGE_API_KEY)",
                duration_ms=int((time.perf_counter() - started) * 1000),
            )
        return ConnectorResult(
            name=self.name,
            events=events,
            error="enabled but no paid market connector configured",
            duration_ms=int((time.perf_counter() - started) * 1000),
        )
