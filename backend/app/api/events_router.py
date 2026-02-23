"""FastAPI router for events, alerts inbox, sources, and system status."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.data.event_store import EventStore
from app.domain.models import AlertRule, SavedQuery, utc_now_iso
from app.jobs.event_ingestion import EventIngestionService


def create_ops_router(
    *,
    store: EventStore,
    ingestion_service: EventIngestionService,
) -> APIRouter:
    router = APIRouter()

    @router.get("/ready")
    def ready_check() -> dict[str, Any]:
        status = ingestion_service.runtime_status()
        sources = store.list_connector_status()
        healthy_sources = sum(1 for source in sources if source.get("last_success_at"))
        ready = healthy_sources > 0 or status.get("last_run_finished_at") is not None
        return {
            "status": "ok" if ready else "degraded",
            "checked_at": utc_now_iso(),
            "sources_total": len(sources),
            "sources_healthy": healthy_sources,
            "job": status,
        }

    @router.get("/events")
    def get_events(
        limit: int = Query(default=120, ge=1, le=500),
        since_hours: int = Query(default=24 * 7, ge=1, le=24 * 90),
        category: str | None = Query(default=None),
        region: str | None = Query(default=None),
        country: str | None = Query(default=None),
        q: str | None = Query(default=None),
        refresh: int = Query(default=0, ge=0, le=1),
    ) -> dict[str, Any]:
        run_summary = None
        if refresh:
            run_summary = ingestion_service.ingest(force=True)
        items = store.list_events(
            limit=limit,
            since_hours=since_hours,
            category=category,
            region=region,
            country=country,
            search_query=q,
        )
        return {
            "items": items,
            "meta": {
                "count": len(items),
                "since_hours": since_hours,
                "refreshed": bool(refresh),
                "run_summary": run_summary,
                "generated_at": utc_now_iso(),
            },
        }

    @router.get("/events/timeline")
    def get_timeline(
        since_hours: int = Query(default=24 * 7, ge=1, le=24 * 90),
        bucket_minutes: int = Query(default=60, ge=15, le=360),
    ) -> dict[str, Any]:
        return {
            "items": store.timeline(since_hours=since_hours, bucket_minutes=bucket_minutes),
            "generated_at": utc_now_iso(),
        }

    @router.get("/events/hotspots")
    def get_hotspots(
        since_hours: int = Query(default=24, ge=1, le=24 * 30),
        limit: int = Query(default=12, ge=1, le=50),
    ) -> dict[str, Any]:
        return {"items": store.hotspots(since_hours=since_hours, limit=limit)}

    @router.get("/events/pulse")
    def get_pulse(
        window_hours: int = Query(default=6, ge=1, le=24 * 7),
        baseline_hours: int = Query(default=24, ge=2, le=24 * 30),
    ) -> dict[str, Any]:
        return {
            "items": store.pulse(window_hours=window_hours, baseline_hours=baseline_hours),
            "window_hours": window_hours,
            "baseline_hours": baseline_hours,
        }

    @router.get("/events/{event_id}")
    def get_event_detail(event_id: str) -> dict[str, Any]:
        event = store.get_event(event_id)
        if event is None:
            raise HTTPException(status_code=404, detail="Event not found")
        related = store.list_cluster_events(str(event.get("cluster_id")), limit=12)
        return {"event": event, "related": related}

    @router.get("/sources")
    def get_sources() -> dict[str, Any]:
        return {"items": store.list_connector_status(), "generated_at": utc_now_iso()}

    @router.get("/jobs/status")
    def get_job_status() -> dict[str, Any]:
        return {
            "job": ingestion_service.runtime_status(),
            "stats": store.stats(),
            "generated_at": utc_now_iso(),
        }

    @router.get("/jobs/logs")
    def get_job_logs(limit: int = Query(default=120, ge=1, le=500)) -> dict[str, Any]:
        return {"items": store.list_ingestion_logs(limit=limit)}

    @router.post("/jobs/run")
    def run_jobs() -> dict[str, Any]:
        return ingestion_service.ingest(force=True)

    @router.get("/alerts/rules")
    def get_alert_rules() -> dict[str, Any]:
        return {"items": store.list_alert_rules()}

    @router.post("/alerts/rules")
    def upsert_alert_rule(payload: dict[str, Any]) -> dict[str, Any]:
        existing_id = str(payload.get("id", "")).strip() or None
        now = utc_now_iso()
        rule = AlertRule(
            id=existing_id or AlertRule(name="temp").id,
            name=str(payload.get("name", "Untitled Rule")).strip() or "Untitled Rule",
            enabled=bool(payload.get("enabled", True)),
            countries=[str(item) for item in payload.get("countries", []) if str(item).strip()],
            regions=[str(item) for item in payload.get("regions", []) if str(item).strip()],
            categories=[str(item) for item in payload.get("categories", []) if str(item).strip()],
            keywords=[str(item) for item in payload.get("keywords", []) if str(item).strip()],
            severity_threshold=int(payload.get("severity_threshold", 60)),
            spike_detection=bool(payload.get("spike_detection", False)),
            action_in_app=bool(payload.get("action_in_app", True)),
            action_webhook_url=payload.get("action_webhook_url"),
            action_slack_webhook=payload.get("action_slack_webhook"),
            created_at=str(payload.get("created_at", now)),
            updated_at=now,
        )
        saved = store.upsert_alert_rule(rule)
        return {"item": saved}

    @router.get("/alerts/inbox")
    def get_alert_inbox(
        status: str | None = Query(default=None, pattern="^(new|acked|resolved)?$"),
        limit: int = Query(default=200, ge=1, le=500),
    ) -> dict[str, Any]:
        return {"items": store.list_alert_inbox(status=status, limit=limit)}

    @router.post("/alerts/inbox/{alert_event_id}/ack")
    def ack_alert(alert_event_id: str) -> dict[str, Any]:
        ok = store.update_alert_event_status(alert_event_id, "acked")
        if not ok:
            raise HTTPException(status_code=404, detail="Alert event not found")
        return {"status": "ok", "alert_event_id": alert_event_id}

    @router.post("/alerts/inbox/{alert_event_id}/resolve")
    def resolve_alert(alert_event_id: str) -> dict[str, Any]:
        ok = store.update_alert_event_status(alert_event_id, "resolved")
        if not ok:
            raise HTTPException(status_code=404, detail="Alert event not found")
        return {"status": "ok", "alert_event_id": alert_event_id}

    @router.get("/queries")
    def list_queries() -> dict[str, Any]:
        return {"items": store.list_saved_queries()}

    @router.post("/queries")
    def save_query(payload: dict[str, Any]) -> dict[str, Any]:
        query = SavedQuery(
            id=str(payload.get("id", "")).strip() or SavedQuery(name="tmp", query="*").id,
            name=str(payload.get("name", "Untitled Query")).strip() or "Untitled Query",
            query=str(payload.get("query", "")).strip(),
            filters=payload.get("filters", {}) if isinstance(payload.get("filters"), dict) else {},
            created_at=str(payload.get("created_at", utc_now_iso())),
            updated_at=utc_now_iso(),
        )
        return {"item": store.upsert_saved_query(query)}

    @router.delete("/queries/{query_id}")
    def delete_query(query_id: str) -> dict[str, Any]:
        deleted = store.delete_saved_query(query_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Query not found")
        return {"status": "ok", "query_id": query_id}

    @router.get("/health/system")
    def health_system() -> dict[str, Any]:
        return {
            "status": "ok",
            "checked_at": utc_now_iso(),
            "job": ingestion_service.runtime_status(),
            "stats": store.stats(),
            "sources": store.list_connector_status(),
        }

    return router
