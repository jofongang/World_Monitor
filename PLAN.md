# PLAN

## 1) Discovery + Baseline Preservation
- Keep existing stack: FastAPI backend + Next.js/TypeScript/Tailwind frontend.
- Preserve current endpoints and routes already in use (`/news`, `/markets`, `/videos`, `/alerts`, `/brief`, `/watchlist`).
- Add new architecture alongside existing logic to avoid destructive rewrites.

## 2) Backend Modular Expansion
- Add modular backend packages in existing conventions:
  - `app/domain` (typed models and validation)
  - `app/data` (SQLite persistence for normalized events, rules, inbox, saved queries)
  - `app/connectors` (USGS, EONET, RSS, GDELT-RSS + optional key-based connectors)
  - `app/jobs` (ingestion scheduler, status, logs, health)
  - `app/api` (new monitor-focused routes)
- Introduce a unified `WorldEvent` model and deterministic dedupe/cluster heuristics.

## 3) Public-Data Event Pipeline
- Implement connectors with retries/backoff, safe parsing, and fault isolation.
- Normalize all connector outputs to unified event schema.
- Persist to SQLite with upsert semantics and fetch checkpoints.
- Add geo fallback via cached centroid resolver + optional Nominatim path behind strict cache/rate limits.

## 4) Alerts, Watchlists, Saved Queries
- Keep existing watchlist behavior.
- Add rule-based alert engine over normalized events:
  - rules (keyword/country/region/category/severity/spike)
  - inbox workflow (new/acked/resolved)
- Add saved queries CRUD for operator workflows.

## 5) Observability + Ops Endpoints
- Add structured logging helpers and request-id middleware.
- Add `/ready`, `/sources`, `/jobs/status`, `/jobs/logs`, `/events/*` endpoints.
- Add health/status metadata for connectors and ingestion scheduler.

## 6) Frontend “World Situation Terminal” Upgrade
- Extend UI architecture with:
  - `core-ui` primitives and shell behavior
  - `domain` types for monitor entities
  - `data` client adapters with polling + lightweight cache
- Build/upgrade routes:
  - `/` and `/dashboard` as ops overview
  - `/grid` monitor wall with resizable panels
  - `/alerts` inbox + rules
  - `/sources` connector status
  - `/health` system/queue health
- Add command palette (Ctrl+K), terminal log panel, keyboard feed nav (j/k/enter/esc), timeline strip, live status lights.

## 7) Safety + Documentation + Tests
- Add `SAFETY.md`, `SOURCES.md`, `DECISIONS.md`, `RUNBOOK.md`, and README updates.
- Add:
  - unit test for a connector transformation
  - integration test for events API endpoint
- Run type checks/tests and resolve issues to leave repo runnable.
