"""Typed domain models for normalized events and alerting."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field, HttpUrl

EventCategory = Literal[
    "conflict",
    "diplomacy",
    "sanctions",
    "cyber",
    "disaster",
    "markets",
    "other",
]

AlertStatus = Literal["new", "acked", "resolved"]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )


class WorldEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    external_id: str
    source: str
    source_url: HttpUrl | str
    title: str
    summary: str = ""
    body_snippet: str = ""
    category: EventCategory = "other"
    tags: list[str] = Field(default_factory=list)
    country: str = "Global"
    region: str = "Global"
    lat: float | None = None
    lon: float | None = None
    geohash: str | None = None
    severity: int = Field(default=30, ge=0, le=100)
    confidence: int = Field(default=70, ge=0, le=100)
    occurred_at: str = Field(default_factory=utc_now_iso)
    started_at: str | None = None
    ingested_at: str = Field(default_factory=utc_now_iso)
    updated_at: str = Field(default_factory=utc_now_iso)
    cluster_id: str
    raw: dict = Field(default_factory=dict)


class AlertRule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    enabled: bool = True
    countries: list[str] = Field(default_factory=list)
    regions: list[str] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    severity_threshold: int = Field(default=60, ge=0, le=100)
    spike_detection: bool = False
    action_in_app: bool = True
    action_webhook_url: str | None = None
    action_slack_webhook: str | None = None
    created_at: str = Field(default_factory=utc_now_iso)
    updated_at: str = Field(default_factory=utc_now_iso)


class AlertEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    rule_id: str
    event_id: str
    status: AlertStatus = "new"
    fired_at: str = Field(default_factory=utc_now_iso)
    acked_at: str | None = None
    resolved_at: str | None = None


class SavedQuery(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    query: str
    filters: dict = Field(default_factory=dict)
    created_at: str = Field(default_factory=utc_now_iso)
    updated_at: str = Field(default_factory=utc_now_iso)


class AuditLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    action: str
    actor: str = "system"
    metadata: dict = Field(default_factory=dict)
    time: str = Field(default_factory=utc_now_iso)

