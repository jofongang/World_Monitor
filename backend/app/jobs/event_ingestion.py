"""Background ingestion scheduler and alert-rule evaluator."""

from __future__ import annotations

import asyncio
import logging
import os
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from app.connectors import EonetConnector, GdeltConnector, RssConnector, UsgsConnector
from app.connectors.common import normalize_text, text_hash
from app.connectors.optional import AcledConnector, MarketOverlayConnector
from app.data.event_store import EventStore
from app.domain.models import AlertEvent, AlertRule, WorldEvent, utc_now_iso

LOGGER = logging.getLogger(__name__)


class EventIngestionService:
    def __init__(self, *, store: EventStore, rss_config_path: Path) -> None:
        self.store = store
        self.refresh_minutes = max(1, int(os.getenv("EVENT_REFRESH_MINUTES", "10")))
        self.connector_delay_seconds = max(
            0.0, float(os.getenv("EVENT_CONNECTOR_DELAY_SECONDS", "0.35"))
        )
        self.scheduler_enabled = (
            os.getenv("EVENT_SCHEDULER_ENABLED", "1").strip().lower()
            not in {"0", "false", "off", "no"}
        )
        self.default_since_hours = max(
            6, int(os.getenv("EVENT_DEFAULT_SINCE_HOURS", "48"))
        )
        self.enable_optional_connectors = (
            os.getenv("ENABLE_OPTIONAL_CONNECTORS", "0").strip().lower()
            in {"1", "true", "yes", "on"}
        )

        self.connectors: list[Any] = [
            UsgsConnector(),
            EonetConnector(),
            GdeltConnector(),
            RssConnector(config_path=rss_config_path),
        ]
        if self.enable_optional_connectors:
            self.connectors.extend([AcledConnector(), MarketOverlayConnector()])

        self._scheduler_task: asyncio.Task[None] | None = None
        self._run_lock = threading.Lock()
        self._state_lock = threading.Lock()
        self._running = False
        self._last_run_started_at: str | None = None
        self._last_run_finished_at: str | None = None
        self._last_error: str | None = None
        self._last_ingested_count = 0

        self.store.ensure_default_alert_rule()

    async def start(self) -> None:
        self.ingest_async(force=True)
        if self.scheduler_enabled and self._scheduler_task is None:
            self._scheduler_task = asyncio.create_task(self._scheduler_loop())

    async def stop(self) -> None:
        if self._scheduler_task is None:
            return
        self._scheduler_task.cancel()
        try:
            await self._scheduler_task
        except asyncio.CancelledError:
            pass
        self._scheduler_task = None

    def runtime_status(self) -> dict[str, Any]:
        with self._state_lock:
            next_run = None
            if self._last_run_started_at:
                started = self._parse_iso(self._last_run_started_at)
                next_run = (
                    started + timedelta(minutes=self.refresh_minutes)
                ).replace(microsecond=0).isoformat().replace("+00:00", "Z")
            return {
                "running": self._running,
                "refresh_minutes": self.refresh_minutes,
                "last_run_started_at": self._last_run_started_at,
                "last_run_finished_at": self._last_run_finished_at,
                "last_error": self._last_error,
                "last_ingested_count": self._last_ingested_count,
                "next_run_at": next_run,
            }

    def ingest(self, *, force: bool = False) -> dict[str, Any]:
        acquired = self._run_lock.acquire(blocking=False)
        if not acquired:
            return {"status": "busy", "ingested": 0}
        try:
            with self._state_lock:
                self._running = True
                self._last_run_started_at = utc_now_iso()
                self._last_error = None
            all_events: list[WorldEvent] = []
            connector_summaries: list[dict[str, Any]] = []

            for connector in self.connectors:
                name = getattr(connector, "name", connector.__class__.__name__)
                enabled = getattr(connector, "enabled", True)
                if enabled is False:
                    self.store.set_connector_status(
                        name=name,
                        enabled=False,
                        success=False,
                        items_fetched=0,
                        duration_ms=0,
                        next_run_at=self._next_run_at(),
                        error_message="connector disabled",
                    )
                    continue

                result = connector.fetch(since_hours=self.default_since_hours)
                events = result.events
                events = self._normalize_clusters(events)
                all_events.extend(events)

                success = result.error is None
                self.store.set_connector_status(
                    name=result.name,
                    enabled=True,
                    success=success,
                    items_fetched=len(events),
                    duration_ms=result.duration_ms,
                    next_run_at=self._next_run_at(),
                    error_message=result.error,
                )
                if success:
                    self.store.add_ingestion_log(
                        level="INFO",
                        connector=result.name,
                        message=f"Fetched {len(events)} events in {result.duration_ms}ms",
                    )
                else:
                    self.store.add_ingestion_log(
                        level="ERROR",
                        connector=result.name,
                        message=result.error or "unknown connector error",
                    )
                connector_summaries.append(
                    {
                        "name": result.name,
                        "items": len(events),
                        "duration_ms": result.duration_ms,
                        "error": result.error,
                    }
                )
                if self.connector_delay_seconds > 0:
                    time.sleep(self.connector_delay_seconds)

            ingested = self.store.upsert_events(all_events)
            fired = self._evaluate_rules(all_events)

            with self._state_lock:
                self._last_ingested_count = ingested
                self._last_run_finished_at = utc_now_iso()
            self.store.add_audit_log(
                action="job.ingest",
                actor="system",
                metadata={
                    "force": force,
                    "ingested": ingested,
                    "alerts_fired": fired,
                    "connector_count": len(connector_summaries),
                },
            )
            return {
                "status": "ok",
                "ingested": ingested,
                "alerts_fired": fired,
                "connectors": connector_summaries,
                "started_at": self._last_run_started_at,
                "finished_at": self._last_run_finished_at,
            }
        except Exception as exc:
            with self._state_lock:
                self._last_error = str(exc)
                self._last_run_finished_at = utc_now_iso()
            LOGGER.exception("Event ingestion run failed")
            self.store.add_ingestion_log(
                level="ERROR",
                connector="scheduler",
                message=f"Ingestion failed: {exc}",
            )
            return {"status": "error", "error": str(exc)}
        finally:
            with self._state_lock:
                self._running = False
            self._run_lock.release()

    def ingest_async(self, *, force: bool = False) -> None:
        thread = threading.Thread(
            target=self.ingest,
            kwargs={"force": force},
            daemon=True,
        )
        thread.start()

    async def _scheduler_loop(self) -> None:
        while True:
            await asyncio.sleep(self.refresh_minutes * 60)
            await asyncio.to_thread(self.ingest, force=False)

    def _normalize_clusters(self, events: list[WorldEvent]) -> list[WorldEvent]:
        for event in events:
            title_key = normalize_text(event.title)[:80]
            country_key = normalize_text(event.country or "global")
            bucket = event.occurred_at[:13]
            event.cluster_id = text_hash(f"{title_key}|{country_key}|{bucket}")[:20]
            event.updated_at = utc_now_iso()
        return events

    def _evaluate_rules(self, events: list[WorldEvent]) -> int:
        if not events:
            return 0
        rules_raw = self.store.list_alert_rules()
        rules = [self._rule_from_dict(item) for item in rules_raw]
        if not rules:
            return 0

        fired = 0
        for rule in rules:
            if not rule.enabled:
                continue
            for event in events:
                if not self._rule_matches(rule, event):
                    continue
                created = self.store.add_alert_event(
                    AlertEvent(rule_id=rule.id, event_id=event.id, status="new")
                )
                if created:
                    fired += 1
        return fired

    def _rule_matches(self, rule: AlertRule, event: WorldEvent) -> bool:
        if event.severity < rule.severity_threshold:
            return False
        if rule.countries and event.country not in rule.countries:
            return False
        if rule.regions and event.region not in rule.regions:
            return False
        if rule.categories and event.category not in rule.categories:
            return False
        if rule.keywords:
            haystack = normalize_text(f"{event.title} {event.summary} {event.body_snippet}")
            if not any(normalize_text(word) in haystack for word in rule.keywords):
                return False
        if rule.spike_detection:
            pulse = self.store.pulse(window_hours=6, baseline_hours=24)
            country_deltas = {item["country"]: float(item["delta_ratio"]) for item in pulse}
            if country_deltas.get(event.country, 0.0) < 1.0:
                return False
        return True

    def _rule_from_dict(self, raw: dict[str, Any]) -> AlertRule:
        return AlertRule(
            id=str(raw.get("id")),
            name=str(raw.get("name")),
            enabled=bool(raw.get("enabled", True)),
            countries=[str(item) for item in raw.get("countries", [])],
            regions=[str(item) for item in raw.get("regions", [])],
            categories=[str(item) for item in raw.get("categories", [])],
            keywords=[str(item) for item in raw.get("keywords", [])],
            severity_threshold=int(raw.get("severity_threshold", 60)),
            spike_detection=bool(raw.get("spike_detection", False)),
            action_in_app=bool(raw.get("action_in_app", True)),
            action_webhook_url=raw.get("action_webhook_url"),
            action_slack_webhook=raw.get("action_slack_webhook"),
            created_at=str(raw.get("created_at", utc_now_iso())),
            updated_at=utc_now_iso(),
        )

    def _next_run_at(self) -> str:
        return (
            datetime.now(timezone.utc) + timedelta(minutes=self.refresh_minutes)
        ).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    def _parse_iso(self, value: str) -> datetime:
        text = value.strip()
        for candidate in (text, text.replace("Z", "+00:00")):
            try:
                parsed = datetime.fromisoformat(candidate)
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=timezone.utc)
                return parsed.astimezone(timezone.utc)
            except ValueError:
                continue
        return datetime.now(timezone.utc)
