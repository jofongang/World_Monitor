"""SQLite-backed persistence for normalized events, alerts, and job status."""

from __future__ import annotations

import hashlib
import json
import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from app.domain.models import AlertEvent, AlertRule, SavedQuery, WorldEvent, utc_now_iso

DEFAULT_DB_NAME = "world_monitor.db"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_text(value: str) -> str:
    lowered = value.lower().strip()
    normalized = "".join(ch if ch.isalnum() else " " for ch in lowered)
    return " ".join(normalized.split())


def _iso_to_datetime(value: str) -> datetime:
    text = str(value).strip()
    if not text:
        return _utc_now()
    for candidate in (text, text.replace("Z", "+00:00")):
        try:
            parsed = datetime.fromisoformat(candidate)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except ValueError:
            continue
    return _utc_now()


def _safe_json_loads(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


class EventStore:
    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = db_path or Path(__file__).resolve().parent / DEFAULT_DB_NAME
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout = 10000")
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = NORMAL")
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS events (
                    id TEXT PRIMARY KEY,
                    external_id TEXT NOT NULL,
                    source TEXT NOT NULL,
                    source_url TEXT NOT NULL,
                    title TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    body_snippet TEXT NOT NULL,
                    category TEXT NOT NULL,
                    tags_json TEXT NOT NULL,
                    country TEXT NOT NULL,
                    region TEXT NOT NULL,
                    lat REAL,
                    lon REAL,
                    geohash TEXT,
                    severity INTEGER NOT NULL,
                    confidence INTEGER NOT NULL,
                    occurred_at TEXT NOT NULL,
                    started_at TEXT,
                    ingested_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    cluster_id TEXT NOT NULL,
                    raw_json TEXT NOT NULL,
                    dedupe_hash TEXT NOT NULL UNIQUE,
                    title_hash TEXT NOT NULL,
                    url_norm TEXT NOT NULL,
                    bucket_hour TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_events_occurred_at ON events(occurred_at DESC);
                CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
                CREATE INDEX IF NOT EXISTS idx_events_region ON events(region);
                CREATE INDEX IF NOT EXISTS idx_events_country ON events(country);
                CREATE INDEX IF NOT EXISTS idx_events_cluster ON events(cluster_id);

                CREATE TABLE IF NOT EXISTS connector_status (
                    name TEXT PRIMARY KEY,
                    enabled INTEGER NOT NULL DEFAULT 1,
                    last_success_at TEXT,
                    last_error_at TEXT,
                    last_error TEXT,
                    next_run_at TEXT,
                    items_fetched INTEGER NOT NULL DEFAULT 0,
                    last_duration_ms INTEGER NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS ingestion_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    level TEXT NOT NULL,
                    connector TEXT NOT NULL,
                    message TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_ingestion_logs_created_at ON ingestion_logs(created_at DESC);

                CREATE TABLE IF NOT EXISTS alert_rules (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    enabled INTEGER NOT NULL DEFAULT 1,
                    countries_json TEXT NOT NULL,
                    regions_json TEXT NOT NULL,
                    categories_json TEXT NOT NULL,
                    keywords_json TEXT NOT NULL,
                    severity_threshold INTEGER NOT NULL,
                    spike_detection INTEGER NOT NULL DEFAULT 0,
                    action_in_app INTEGER NOT NULL DEFAULT 1,
                    action_webhook_url TEXT,
                    action_slack_webhook TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS alert_events (
                    id TEXT PRIMARY KEY,
                    rule_id TEXT NOT NULL,
                    event_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    fired_at TEXT NOT NULL,
                    acked_at TEXT,
                    resolved_at TEXT,
                    UNIQUE(rule_id, event_id)
                );
                CREATE INDEX IF NOT EXISTS idx_alert_events_status ON alert_events(status);

                CREATE TABLE IF NOT EXISTS saved_queries (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    query TEXT NOT NULL,
                    filters_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS audit_logs (
                    id TEXT PRIMARY KEY,
                    action TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    metadata_json TEXT NOT NULL,
                    time TEXT NOT NULL
                );
                """
            )
            conn.commit()

    def _event_hashes(self, event: WorldEvent) -> dict[str, str]:
        title_norm = _normalize_text(event.title)
        title_hash = hashlib.sha256(title_norm.encode("utf-8")).hexdigest()
        url_norm = str(event.source_url).strip().lower()
        bucket = _iso_to_datetime(event.occurred_at).strftime("%Y-%m-%dT%H")
        if url_norm:
            dedupe_base = f"url:{url_norm}"
        else:
            dedupe_base = f"title:{title_norm}|country:{_normalize_text(event.country)}|bucket:{bucket}"
        dedupe_hash = hashlib.sha256(dedupe_base.encode("utf-8")).hexdigest()
        return {
            "dedupe_hash": dedupe_hash,
            "title_hash": title_hash,
            "url_norm": url_norm,
            "bucket_hour": bucket,
        }

    def upsert_events(self, events: list[WorldEvent]) -> int:
        if not events:
            return 0
        with self._lock, self._connect() as conn:
            cursor = conn.cursor()
            for event in events:
                hashes = self._event_hashes(event)
                cursor.execute(
                    """
                    INSERT INTO events (
                        id, external_id, source, source_url, title, summary, body_snippet,
                        category, tags_json, country, region, lat, lon, geohash, severity,
                        confidence, occurred_at, started_at, ingested_at, updated_at, cluster_id,
                        raw_json, dedupe_hash, title_hash, url_norm, bucket_hour
                    ) VALUES (
                        :id, :external_id, :source, :source_url, :title, :summary, :body_snippet,
                        :category, :tags_json, :country, :region, :lat, :lon, :geohash, :severity,
                        :confidence, :occurred_at, :started_at, :ingested_at, :updated_at, :cluster_id,
                        :raw_json, :dedupe_hash, :title_hash, :url_norm, :bucket_hour
                    )
                    ON CONFLICT(dedupe_hash) DO UPDATE SET
                        source = excluded.source,
                        source_url = excluded.source_url,
                        title = excluded.title,
                        summary = excluded.summary,
                        body_snippet = excluded.body_snippet,
                        category = excluded.category,
                        tags_json = excluded.tags_json,
                        country = excluded.country,
                        region = excluded.region,
                        lat = excluded.lat,
                        lon = excluded.lon,
                        geohash = excluded.geohash,
                        severity = excluded.severity,
                        confidence = excluded.confidence,
                        occurred_at = excluded.occurred_at,
                        started_at = excluded.started_at,
                        ingested_at = excluded.ingested_at,
                        updated_at = excluded.updated_at,
                        cluster_id = excluded.cluster_id,
                        raw_json = excluded.raw_json,
                        title_hash = excluded.title_hash,
                        url_norm = excluded.url_norm,
                        bucket_hour = excluded.bucket_hour
                    """,
                    {
                        "id": event.id,
                        "external_id": event.external_id,
                        "source": event.source,
                        "source_url": str(event.source_url),
                        "title": event.title,
                        "summary": event.summary,
                        "body_snippet": event.body_snippet,
                        "category": event.category,
                        "tags_json": json.dumps(event.tags),
                        "country": event.country,
                        "region": event.region,
                        "lat": event.lat,
                        "lon": event.lon,
                        "geohash": event.geohash,
                        "severity": event.severity,
                        "confidence": event.confidence,
                        "occurred_at": event.occurred_at,
                        "started_at": event.started_at,
                        "ingested_at": event.ingested_at,
                        "updated_at": event.updated_at,
                        "cluster_id": event.cluster_id,
                        "raw_json": json.dumps(event.raw),
                        **hashes,
                    },
                )
            conn.commit()
            return len(events)

    def list_events(
        self,
        *,
        limit: int = 120,
        since_hours: int = 24 * 7,
        category: str | None = None,
        region: str | None = None,
        country: str | None = None,
        search_query: str | None = None,
    ) -> list[dict[str, Any]]:
        clauses = ["occurred_at >= :cutoff"]
        params: dict[str, Any] = {
            "cutoff": (_utc_now() - timedelta(hours=max(1, since_hours))).isoformat().replace(
                "+00:00", "Z"
            ),
            "limit": max(1, min(limit, 500)),
        }
        if category:
            clauses.append("category = :category")
            params["category"] = category
        if region:
            clauses.append("region = :region")
            params["region"] = region
        if country:
            clauses.append("country = :country")
            params["country"] = country
        if search_query:
            clauses.append("(title LIKE :q OR summary LIKE :q OR tags_json LIKE :q)")
            params["q"] = f"%{search_query.strip()}%"

        where_sql = " AND ".join(clauses)
        sql = f"""
            SELECT * FROM events
            WHERE {where_sql}
            ORDER BY occurred_at DESC
            LIMIT :limit
        """

        with self._connect() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [self._row_to_event_dict(row) for row in rows]

    def get_event(self, event_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM events WHERE id = :id", {"id": event_id}).fetchone()
        if row is None:
            return None
        return self._row_to_event_dict(row)

    def list_cluster_events(self, cluster_id: str, limit: int = 12) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM events
                WHERE cluster_id = :cluster_id
                ORDER BY occurred_at DESC
                LIMIT :limit
                """,
                {"cluster_id": cluster_id, "limit": max(1, min(limit, 100))},
            ).fetchall()
        return [self._row_to_event_dict(row) for row in rows]

    def hotspots(self, since_hours: int = 24, limit: int = 12) -> list[dict[str, Any]]:
        cutoff = (_utc_now() - timedelta(hours=max(1, since_hours))).isoformat().replace(
            "+00:00", "Z"
        )
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT country, region, COUNT(*) AS event_count,
                    AVG(severity) AS avg_severity,
                    MAX(occurred_at) AS latest_at
                FROM events
                WHERE occurred_at >= :cutoff
                GROUP BY country, region
                ORDER BY event_count DESC, avg_severity DESC
                LIMIT :limit
                """,
                {"cutoff": cutoff, "limit": max(1, min(limit, 50))},
            ).fetchall()
        return [
            {
                "country": row["country"],
                "region": row["region"],
                "event_count": int(row["event_count"]),
                "avg_severity": round(float(row["avg_severity"] or 0.0), 2),
                "latest_at": row["latest_at"],
            }
            for row in rows
        ]

    def timeline(self, since_hours: int = 24 * 7, bucket_minutes: int = 60) -> list[dict[str, Any]]:
        safe_minutes = 15 if bucket_minutes < 15 else min(bucket_minutes, 6 * 60)
        cutoff = (_utc_now() - timedelta(hours=max(1, since_hours))).isoformat().replace(
            "+00:00", "Z"
        )
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT
                    strftime('%Y-%m-%dT%H:%M:00Z',
                        datetime(
                            CAST(strftime('%s', occurred_at) / (:bucket * 60) AS INTEGER) * (:bucket * 60),
                            'unixepoch'
                        )
                    ) AS bucket_time,
                    COUNT(*) AS event_count,
                    AVG(severity) AS avg_severity
                FROM events
                WHERE occurred_at >= :cutoff
                GROUP BY bucket_time
                ORDER BY bucket_time ASC
                """,
                {"cutoff": cutoff, "bucket": safe_minutes},
            ).fetchall()
        return [
            {
                "bucket_time": row["bucket_time"],
                "event_count": int(row["event_count"]),
                "avg_severity": round(float(row["avg_severity"] or 0.0), 2),
            }
            for row in rows
        ]

    def pulse(self, window_hours: int = 6, baseline_hours: int = 24) -> list[dict[str, Any]]:
        now = _utc_now()
        window_cutoff = (now - timedelta(hours=max(1, window_hours))).isoformat().replace(
            "+00:00", "Z"
        )
        baseline_cutoff = (now - timedelta(hours=max(window_hours + 1, baseline_hours))).isoformat().replace(
            "+00:00", "Z"
        )
        with self._connect() as conn:
            recent_rows = conn.execute(
                """
                SELECT country, COUNT(*) AS cnt
                FROM events
                WHERE occurred_at >= :window_cutoff
                GROUP BY country
                """,
                {"window_cutoff": window_cutoff},
            ).fetchall()
            baseline_rows = conn.execute(
                """
                SELECT country, COUNT(*) AS cnt
                FROM events
                WHERE occurred_at >= :baseline_cutoff
                  AND occurred_at < :window_cutoff
                GROUP BY country
                """,
                {"window_cutoff": window_cutoff, "baseline_cutoff": baseline_cutoff},
            ).fetchall()

        recent = {row["country"]: int(row["cnt"]) for row in recent_rows}
        baseline = {row["country"]: int(row["cnt"]) for row in baseline_rows}
        countries = sorted(set(recent) | set(baseline))
        pulse: list[dict[str, Any]] = []
        for country in countries:
            recent_count = recent.get(country, 0)
            baseline_count = baseline.get(country, 0)
            if recent_count <= 0:
                continue
            if baseline_count <= 0:
                delta_ratio = float(recent_count)
            else:
                delta_ratio = (recent_count - baseline_count) / max(1.0, baseline_count)
            pulse.append(
                {
                    "country": country,
                    "recent_count": recent_count,
                    "baseline_count": baseline_count,
                    "delta_ratio": round(delta_ratio, 3),
                }
            )
        pulse.sort(key=lambda item: (item["delta_ratio"], item["recent_count"]), reverse=True)
        return pulse[:12]

    def set_connector_status(
        self,
        *,
        name: str,
        enabled: bool,
        success: bool,
        items_fetched: int,
        duration_ms: int,
        next_run_at: str | None,
        error_message: str | None = None,
    ) -> None:
        now = utc_now_iso()
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO connector_status (
                    name, enabled, last_success_at, last_error_at, last_error,
                    next_run_at, items_fetched, last_duration_ms, updated_at
                ) VALUES (
                    :name, :enabled, :last_success_at, :last_error_at, :last_error,
                    :next_run_at, :items_fetched, :last_duration_ms, :updated_at
                )
                ON CONFLICT(name) DO UPDATE SET
                    enabled = excluded.enabled,
                    last_success_at = CASE WHEN excluded.last_success_at IS NOT NULL
                        THEN excluded.last_success_at ELSE connector_status.last_success_at END,
                    last_error_at = CASE WHEN excluded.last_error_at IS NOT NULL
                        THEN excluded.last_error_at ELSE connector_status.last_error_at END,
                    last_error = excluded.last_error,
                    next_run_at = excluded.next_run_at,
                    items_fetched = excluded.items_fetched,
                    last_duration_ms = excluded.last_duration_ms,
                    updated_at = excluded.updated_at
                """,
                {
                    "name": name,
                    "enabled": 1 if enabled else 0,
                    "last_success_at": now if success else None,
                    "last_error_at": now if not success else None,
                    "last_error": error_message,
                    "next_run_at": next_run_at,
                    "items_fetched": max(0, items_fetched),
                    "last_duration_ms": max(0, duration_ms),
                    "updated_at": now,
                },
            )
            conn.commit()

    def list_connector_status(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM connector_status ORDER BY name ASC").fetchall()
        return [
            {
                "name": row["name"],
                "enabled": bool(row["enabled"]),
                "last_success_at": row["last_success_at"],
                "last_error_at": row["last_error_at"],
                "last_error": row["last_error"],
                "next_run_at": row["next_run_at"],
                "items_fetched": int(row["items_fetched"]),
                "last_duration_ms": int(row["last_duration_ms"]),
                "updated_at": row["updated_at"],
            }
            for row in rows
        ]

    def add_ingestion_log(self, *, level: str, connector: str, message: str) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO ingestion_logs (created_at, level, connector, message)
                VALUES (:created_at, :level, :connector, :message)
                """,
                {
                    "created_at": utc_now_iso(),
                    "level": level.upper(),
                    "connector": connector,
                    "message": message[:800],
                },
            )
            conn.commit()

    def list_ingestion_logs(self, limit: int = 200) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM ingestion_logs
                ORDER BY created_at DESC
                LIMIT :limit
                """,
                {"limit": max(1, min(limit, 500))},
            ).fetchall()
        return [
            {
                "id": int(row["id"]),
                "created_at": row["created_at"],
                "level": row["level"],
                "connector": row["connector"],
                "message": row["message"],
            }
            for row in rows
        ]

    def upsert_alert_rule(self, rule: AlertRule) -> dict[str, Any]:
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO alert_rules (
                    id, name, enabled, countries_json, regions_json, categories_json, keywords_json,
                    severity_threshold, spike_detection, action_in_app, action_webhook_url,
                    action_slack_webhook, created_at, updated_at
                ) VALUES (
                    :id, :name, :enabled, :countries_json, :regions_json, :categories_json, :keywords_json,
                    :severity_threshold, :spike_detection, :action_in_app, :action_webhook_url,
                    :action_slack_webhook, :created_at, :updated_at
                )
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    enabled = excluded.enabled,
                    countries_json = excluded.countries_json,
                    regions_json = excluded.regions_json,
                    categories_json = excluded.categories_json,
                    keywords_json = excluded.keywords_json,
                    severity_threshold = excluded.severity_threshold,
                    spike_detection = excluded.spike_detection,
                    action_in_app = excluded.action_in_app,
                    action_webhook_url = excluded.action_webhook_url,
                    action_slack_webhook = excluded.action_slack_webhook,
                    updated_at = excluded.updated_at
                """,
                {
                    "id": rule.id,
                    "name": rule.name,
                    "enabled": 1 if rule.enabled else 0,
                    "countries_json": json.dumps(rule.countries),
                    "regions_json": json.dumps(rule.regions),
                    "categories_json": json.dumps(rule.categories),
                    "keywords_json": json.dumps(rule.keywords),
                    "severity_threshold": rule.severity_threshold,
                    "spike_detection": 1 if rule.spike_detection else 0,
                    "action_in_app": 1 if rule.action_in_app else 0,
                    "action_webhook_url": rule.action_webhook_url,
                    "action_slack_webhook": rule.action_slack_webhook,
                    "created_at": rule.created_at,
                    "updated_at": rule.updated_at,
                },
            )
            conn.commit()
        return self._alert_rule_to_dict(rule)

    def list_alert_rules(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM alert_rules ORDER BY updated_at DESC, name ASC").fetchall()
        return [self._row_to_rule_dict(row) for row in rows]

    def ensure_default_alert_rule(self) -> None:
        if self.list_alert_rules():
            return
        now = utc_now_iso()
        self.upsert_alert_rule(
            AlertRule(
                name="High Severity Monitor",
                severity_threshold=65,
                categories=["conflict", "disaster", "sanctions"],
                keywords=["attack", "earthquake", "sanctions", "ceasefire"],
                created_at=now,
                updated_at=now,
            )
        )

    def add_alert_event(self, alert_event: AlertEvent) -> bool:
        with self._lock, self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT OR IGNORE INTO alert_events (
                    id, rule_id, event_id, status, fired_at, acked_at, resolved_at
                ) VALUES (
                    :id, :rule_id, :event_id, :status, :fired_at, :acked_at, :resolved_at
                )
                """,
                {
                    "id": alert_event.id,
                    "rule_id": alert_event.rule_id,
                    "event_id": alert_event.event_id,
                    "status": alert_event.status,
                    "fired_at": alert_event.fired_at,
                    "acked_at": alert_event.acked_at,
                    "resolved_at": alert_event.resolved_at,
                },
            )
            conn.commit()
            return cursor.rowcount > 0

    def list_alert_inbox(self, *, status: str | None = None, limit: int = 200) -> list[dict[str, Any]]:
        sql = """
            SELECT
                ae.id AS alert_event_id,
                ae.rule_id,
                ae.event_id,
                ae.status,
                ae.fired_at,
                ae.acked_at,
                ae.resolved_at,
                r.name AS rule_name,
                e.title,
                e.source,
                e.source_url,
                e.category,
                e.country,
                e.region,
                e.severity,
                e.confidence,
                e.occurred_at,
                e.cluster_id
            FROM alert_events ae
            JOIN alert_rules r ON r.id = ae.rule_id
            JOIN events e ON e.id = ae.event_id
        """
        params: dict[str, Any] = {"limit": max(1, min(limit, 500))}
        if status:
            sql += " WHERE ae.status = :status"
            params["status"] = status
        sql += " ORDER BY ae.fired_at DESC LIMIT :limit"

        with self._connect() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [
            {
                "alert_event_id": row["alert_event_id"],
                "rule_id": row["rule_id"],
                "rule_name": row["rule_name"],
                "event_id": row["event_id"],
                "status": row["status"],
                "fired_at": row["fired_at"],
                "acked_at": row["acked_at"],
                "resolved_at": row["resolved_at"],
                "title": row["title"],
                "source": row["source"],
                "source_url": row["source_url"],
                "category": row["category"],
                "country": row["country"],
                "region": row["region"],
                "severity": int(row["severity"]),
                "confidence": int(row["confidence"]),
                "occurred_at": row["occurred_at"],
                "cluster_id": row["cluster_id"],
            }
            for row in rows
        ]

    def update_alert_event_status(self, alert_event_id: str, status: str) -> bool:
        safe_status = status.strip().lower()
        if safe_status not in {"acked", "resolved"}:
            return False

        now = utc_now_iso()
        set_columns = "status = :status, acked_at = :acked_at" if safe_status == "acked" else (
            "status = :status, resolved_at = :resolved_at, acked_at = COALESCE(acked_at, :resolved_at)"
        )
        params = {
            "status": safe_status,
            "id": alert_event_id,
            "acked_at": now if safe_status == "acked" else None,
            "resolved_at": now if safe_status == "resolved" else None,
        }
        with self._lock, self._connect() as conn:
            cursor = conn.execute(f"UPDATE alert_events SET {set_columns} WHERE id = :id", params)
            conn.commit()
            return cursor.rowcount > 0

    def upsert_saved_query(self, query: SavedQuery) -> dict[str, Any]:
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO saved_queries (id, name, query, filters_json, created_at, updated_at)
                VALUES (:id, :name, :query, :filters_json, :created_at, :updated_at)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    query = excluded.query,
                    filters_json = excluded.filters_json,
                    updated_at = excluded.updated_at
                """,
                {
                    "id": query.id,
                    "name": query.name,
                    "query": query.query,
                    "filters_json": json.dumps(query.filters),
                    "created_at": query.created_at,
                    "updated_at": query.updated_at,
                },
            )
            conn.commit()
        return {
            "id": query.id,
            "name": query.name,
            "query": query.query,
            "filters": query.filters,
            "created_at": query.created_at,
            "updated_at": query.updated_at,
        }

    def list_saved_queries(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM saved_queries ORDER BY updated_at DESC, name ASC").fetchall()
        return [
            {
                "id": row["id"],
                "name": row["name"],
                "query": row["query"],
                "filters": _safe_json_loads(row["filters_json"], {}),
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
            for row in rows
        ]

    def delete_saved_query(self, query_id: str) -> bool:
        with self._lock, self._connect() as conn:
            cursor = conn.execute("DELETE FROM saved_queries WHERE id = :id", {"id": query_id})
            conn.commit()
            return cursor.rowcount > 0

    def add_audit_log(self, *, action: str, actor: str, metadata: dict[str, Any]) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO audit_logs (id, action, actor, metadata_json, time)
                VALUES (:id, :action, :actor, :metadata_json, :time)
                """,
                {
                    "id": hashlib.sha1(f"{utc_now_iso()}|{action}|{actor}".encode("utf-8")).hexdigest(),
                    "action": action,
                    "actor": actor,
                    "metadata_json": json.dumps(metadata),
                    "time": utc_now_iso(),
                },
            )
            conn.commit()

    def stats(self) -> dict[str, Any]:
        now = _utc_now()
        last_24h = (now - timedelta(hours=24)).isoformat().replace("+00:00", "Z")
        with self._connect() as conn:
            total_events = conn.execute("SELECT COUNT(*) AS c FROM events").fetchone()["c"]
            events_24h = conn.execute(
                "SELECT COUNT(*) AS c FROM events WHERE occurred_at >= :cutoff", {"cutoff": last_24h}
            ).fetchone()["c"]
            open_alerts = conn.execute(
                "SELECT COUNT(*) AS c FROM alert_events WHERE status = 'new'"
            ).fetchone()["c"]
            latest = conn.execute("SELECT MAX(occurred_at) AS latest FROM events").fetchone()["latest"]
        return {
            "total_events": int(total_events),
            "events_24h": int(events_24h),
            "open_alerts": int(open_alerts),
            "latest_event_at": latest,
        }

    def _row_to_event_dict(self, row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "external_id": row["external_id"],
            "source": row["source"],
            "source_url": row["source_url"],
            "title": row["title"],
            "summary": row["summary"],
            "body_snippet": row["body_snippet"],
            "category": row["category"],
            "tags": _safe_json_loads(row["tags_json"], []),
            "country": row["country"],
            "region": row["region"],
            "lat": row["lat"],
            "lon": row["lon"],
            "geohash": row["geohash"],
            "severity": int(row["severity"]),
            "confidence": int(row["confidence"]),
            "occurred_at": row["occurred_at"],
            "started_at": row["started_at"],
            "ingested_at": row["ingested_at"],
            "updated_at": row["updated_at"],
            "cluster_id": row["cluster_id"],
            "raw": _safe_json_loads(row["raw_json"], {}),
        }

    def _row_to_rule_dict(self, row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "name": row["name"],
            "enabled": bool(row["enabled"]),
            "countries": _safe_json_loads(row["countries_json"], []),
            "regions": _safe_json_loads(row["regions_json"], []),
            "categories": _safe_json_loads(row["categories_json"], []),
            "keywords": _safe_json_loads(row["keywords_json"], []),
            "severity_threshold": int(row["severity_threshold"]),
            "spike_detection": bool(row["spike_detection"]),
            "action_in_app": bool(row["action_in_app"]),
            "action_webhook_url": row["action_webhook_url"],
            "action_slack_webhook": row["action_slack_webhook"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    def _alert_rule_to_dict(self, rule: AlertRule) -> dict[str, Any]:
        return {
            "id": rule.id,
            "name": rule.name,
            "enabled": rule.enabled,
            "countries": rule.countries,
            "regions": rule.regions,
            "categories": rule.categories,
            "keywords": rule.keywords,
            "severity_threshold": rule.severity_threshold,
            "spike_detection": rule.spike_detection,
            "action_in_app": rule.action_in_app,
            "action_webhook_url": rule.action_webhook_url,
            "action_slack_webhook": rule.action_slack_webhook,
            "created_at": rule.created_at,
            "updated_at": rule.updated_at,
        }
