# Decisions

## Assumptions

- Existing FastAPI and Next.js endpoints/features must remain intact; new capabilities are additive.
- Free/public feeds should be primary path; key-based connectors are stubs behind flags.
- SQLite is acceptable for stable local persistence and job metadata in this phase.
- Scheduler defaults to 10 minutes and can be disabled with env flags.
- If external connectors fail, UI/API should continue from cached/local data and expose degraded status.

## Architecture Choices

- Added modular backend layers:
  - `backend/app/domain`: typed event and alert models.
  - `backend/app/data`: SQLite `EventStore`.
  - `backend/app/connectors`: pluggable adapters (USGS, EONET, GDELT, RSS, optional stubs).
  - `backend/app/jobs`: ingestion scheduler + alert-rule evaluation.
  - `backend/app/api`: additive ops router (`/events`, `/sources`, `/jobs/*`, `/alerts/rules`, `/alerts/inbox`, `/queries`, `/ready`).
- Existing endpoints (`/news`, `/markets`, `/videos`, `/watchlist`, `/alerts`, `/brief`) are preserved.

## Reliability Decisions

- Connector failures are isolated per adapter and logged; failed adapters do not stop the run.
- Event dedupe uses deterministic hash via URL fallback title/country/time bucket.
- Clustering uses deterministic normalized title + country + hour bucket.
- Request IDs are added through middleware and returned in `x-request-id`.

## UX Decisions

- Kept and extended terminal visual language (dark navy/black, electric blue, dense panels).
- Added command palette (`Ctrl+K`), monitor wall route (`/grid`), alert inbox (`/alerts`), source status (`/sources`), and health board (`/health`).
- Added timeline strip and terminal log panel to strengthen “live ops terminal” feel.
