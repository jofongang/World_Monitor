"""Shared classification helpers for normalized world events."""

from __future__ import annotations

import hashlib
import re
from typing import Literal

EventCategory = Literal[
    "conflict",
    "diplomacy",
    "sanctions",
    "cyber",
    "disaster",
    "markets",
    "other",
]

NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")
MULTISPACE_RE = re.compile(r"\s+")


def normalize_text(value: str) -> str:
    lowered = value.lower()
    cleaned = NON_ALNUM_RE.sub(" ", lowered)
    return MULTISPACE_RE.sub(" ", cleaned).strip()


def text_hash(value: str) -> str:
    normalized = normalize_text(value)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


CATEGORY_RULES: tuple[tuple[EventCategory, tuple[str, ...]], ...] = (
    ("conflict", ("war", "battle", "attack", "strike", "military", "troops")),
    ("sanctions", ("sanctions", "embargo", "asset freeze", "export controls")),
    ("cyber", ("cyber", "malware", "ransomware", "breach", "hack", "ddos")),
    ("disaster", ("earthquake", "flood", "wildfire", "hurricane", "storm", "volcano")),
    ("markets", ("market", "stocks", "bond", "yield", "oil", "gas", "gold", "dxy")),
    ("diplomacy", ("summit", "talks", "foreign minister", "un", "nato", "treaty")),
)


def infer_category(text: str, fallback: EventCategory = "other") -> EventCategory:
    normalized = f" {normalize_text(text)} "
    for category, keywords in CATEGORY_RULES:
        for keyword in keywords:
            token = normalize_text(keyword)
            if token and f" {token} " in normalized:
                return category
    return fallback


def infer_severity(category: str, text: str) -> int:
    normalized = f" {normalize_text(text)} "
    base = {
        "conflict": 78,
        "disaster": 72,
        "sanctions": 68,
        "cyber": 60,
        "diplomacy": 45,
        "markets": 42,
        "other": 34,
    }.get(category, 34)
    amplifiers = (
        "major",
        "dead",
        "killed",
        "urgent",
        "emergency",
        "warning",
        "missile",
        "ceasefire",
        "default",
    )
    score = base
    for token in amplifiers:
        norm_token = normalize_text(token)
        if norm_token and f" {norm_token} " in normalized:
            score += 4
    return max(0, min(100, score))
