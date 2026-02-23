# Runbook

## Core Services

- Backend: FastAPI at `http://localhost:8000`
- Frontend: Next.js at `http://localhost:3000`

## Key Health Endpoints

- `GET /health` -> process alive check
- `GET /ready` -> ingestion readiness and connector health summary
- `GET /health/system` -> combined job/sources/event stats
- `GET /sources` -> connector status table
- `GET /jobs/status` -> scheduler runtime status
- `GET /jobs/logs` -> ingestion logs

## If status turns red/degraded

1. Check backend process and `GET /health`.
2. Check `GET /sources` for failing connectors and latest errors.
3. Run one manual ingestion cycle: `POST /jobs/run`.
4. Review `GET /jobs/logs` and verify events are flowing via `GET /events`.
5. If internet feeds are failing globally, continue operations in degraded mode using cached events.

## Useful Environment Variables

- `EVENT_SCHEDULER_ENABLED` (`1`/`0`)
- `EVENT_REFRESH_MINUTES` (default `10`)
- `EVENT_CONNECTOR_DELAY_SECONDS` (default `0.35`)
- `EVENT_DEFAULT_SINCE_HOURS` (default `48`)
- `ENABLE_OPTIONAL_CONNECTORS` (`1` enables optional stubs)
- `GDELT_QUERY`, `GDELT_MAX_RECORDS`
- `ACLED_API_KEY`, `ACLED_EMAIL`, `ALPHA_VANTAGE_API_KEY` (optional)

## Adding/Removing RSS Sources

- Edit `backend/app/sources_config.json`.
- Add/remove entries under `sources` with:
  - `name`
  - `urls` (list)
  - optional `category`
- Restart backend or trigger a manual refresh (`POST /jobs/run`).
