from __future__ import annotations

import json
import shutil
import sys
import unittest
import uuid
import warnings
from pathlib import Path
from typing import Any

from fastapi import FastAPI

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api import create_ops_router
from app.connectors.base import ConnectorResult
from app.data.event_store import EventStore
from app.domain.models import WorldEvent
from app.jobs import EventIngestionService

warnings.filterwarnings("ignore", category=ResourceWarning, message="unclosed database")


class FakeConnector:
    name = "Fake Connector"

    def fetch(self, *, since_hours: int = 48) -> ConnectorResult:
        event = WorldEvent(
            external_id="fake-1",
            source=self.name,
            source_url="https://example.com/event",
            title="Synthetic event for integration test",
            summary="Test summary",
            body_snippet="Body",
            category="other",
            tags=["test"],
            country="Global",
            region="Global",
            lat=None,
            lon=None,
            geohash=None,
            severity=50,
            confidence=90,
            occurred_at="2026-02-20T10:00:00Z",
            started_at="2026-02-20T10:00:00Z",
            cluster_id="cluster-test",
            raw={"test": True},
        )
        return ConnectorResult(name=self.name, events=[event], error=None, duration_ms=1)


class EventsApiIntegrationTest(unittest.TestCase):
    def test_events_endpoint_returns_items(self) -> None:
        base_tmp = Path(__file__).resolve().parent / ".tmp"
        base_tmp.mkdir(parents=True, exist_ok=True)
        tmp = base_tmp / f"events_{uuid.uuid4().hex}"
        tmp.mkdir(parents=True, exist_ok=True)

        try:
            db_path = tmp / "world_monitor.db"
            sources_path = tmp / "sources.json"
            sources_path.write_text(
                json.dumps(
                    {
                        "sources": [
                            {
                                "name": "Dummy",
                                "urls": ["https://example.com/feed.xml"],
                                "category": "other",
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )

            store = EventStore(db_path=db_path)
            ingestion_service = EventIngestionService(store=store, rss_config_path=sources_path)
            ingestion_service.connectors = [FakeConnector()]
            ingestion_service.ingest(force=True)

            app = FastAPI()
            app.include_router(create_ops_router(store=store, ingestion_service=ingestion_service))

            endpoint = None
            for route in app.routes:
                if getattr(route, "path", None) == "/events":
                    endpoint = route.endpoint
                    break
            self.assertIsNotNone(endpoint, "Missing /events endpoint")

            payload: dict[str, Any] = endpoint(  # type: ignore[misc]
                limit=50,
                since_hours=24 * 30,
                category=None,
                region=None,
                country=None,
                q=None,
                refresh=0,
            )

            self.assertIn("items", payload)
            self.assertGreaterEqual(len(payload["items"]), 1)
            self.assertEqual(payload["items"][0]["title"], "Synthetic event for integration test")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
