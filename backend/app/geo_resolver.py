"""Deterministic country centroid resolver for news geo-tagging."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")
MULTISPACE_RE = re.compile(r"\s+")


def _normalize_text(value: str) -> str:
    lowered = value.lower()
    alnum = NON_ALNUM_RE.sub(" ", lowered)
    return MULTISPACE_RE.sub(" ", alnum).strip()


class GeoResolver:
    def __init__(self, centroids_path: Path) -> None:
        payload = json.loads(centroids_path.read_text(encoding="utf-8"))
        countries = payload.get("countries", [])
        if not isinstance(countries, list):
            countries = []

        self._countries_by_name: dict[str, dict[str, Any]] = {}
        self._aliases: list[tuple[str, str]] = []

        for country_obj in countries:
            if not isinstance(country_obj, dict):
                continue
            country_name = str(country_obj.get("country", "")).strip()
            if not country_name:
                continue

            normalized_name = _normalize_text(country_name)
            self._countries_by_name[normalized_name] = country_obj

            aliases = country_obj.get("aliases", [])
            if isinstance(aliases, list):
                for alias in aliases:
                    alias_text = _normalize_text(str(alias))
                    if alias_text:
                        self._aliases.append((alias_text, normalized_name))

            self._aliases.append((normalized_name, normalized_name))

        self._aliases.sort(key=lambda item: len(item[0]), reverse=True)

    def resolve(self, country: str | None, region: str | None, text: str) -> dict[str, Any]:
        country_name = (country or "").strip()
        region_name = (region or "").strip() or "Global"

        direct = self._lookup_country(country_name)
        if direct:
            return direct

        if country_name and country_name.lower() not in {"global", "unknown"}:
            return {
                "country": country_name,
                "region": region_name,
                "lat": None,
                "lon": None,
                "location_label": country_name,
            }

        detected = self._detect_country_from_text(text)
        if detected:
            return detected

        return {
            "country": country_name or "Global",
            "region": region_name,
            "lat": None,
            "lon": None,
            "location_label": None,
        }

    def _lookup_country(self, country: str) -> dict[str, Any] | None:
        normalized = _normalize_text(country)
        if not normalized or normalized in {"global", "unknown"}:
            return None

        spec = self._countries_by_name.get(normalized)
        if spec is None:
            for alias, canonical in self._aliases:
                if alias == normalized:
                    spec = self._countries_by_name.get(canonical)
                    break

        if spec is None:
            return None

        return {
            "country": str(spec.get("country", country)).strip() or country,
            "region": str(spec.get("region", "Global")).strip() or "Global",
            "lat": _coerce_float(spec.get("lat")),
            "lon": _coerce_float(spec.get("lon")),
            "location_label": str(spec.get("country", country)).strip() or country,
        }

    def _detect_country_from_text(self, text: str) -> dict[str, Any] | None:
        normalized = f" {_normalize_text(text)} "
        if normalized.strip() == "":
            return None

        for alias, canonical in self._aliases:
            needle = f" {alias} "
            if needle not in normalized:
                continue

            spec = self._countries_by_name.get(canonical)
            if spec is None:
                continue

            country_name = str(spec.get("country", "")).strip()
            if not country_name:
                continue

            return {
                "country": country_name,
                "region": str(spec.get("region", "Global")).strip() or "Global",
                "lat": _coerce_float(spec.get("lat")),
                "lon": _coerce_float(spec.get("lon")),
                "location_label": country_name,
            }

        return None


def _coerce_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
