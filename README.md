# World Monitor

World Monitor is a terminal-style situational awareness dashboard built with:
- Frontend: Next.js + TypeScript + Tailwind
- Backend: FastAPI

It combines public OSINT feeds into a unified event pipeline with alerting, source status, and operator-focused UI panels.

## Quick Start

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
& 'C:\Program Files\nodejs\npm.cmd' install
& 'C:\Program Files\nodejs\npm.cmd' run dev
```

## URLs

- Frontend: `http://localhost:3000`
- Dashboard: `http://localhost:3000/dashboard`
- Monitor Wall: `http://localhost:3000/grid`
- Alerts: `http://localhost:3000/alerts`
- Sources: `http://localhost:3000/sources`
- Health: `http://localhost:3000/health`
- Backend health: `http://localhost:8000/health`

## New Backend APIs

- `GET /ready`
- `GET /events`
- `GET /events/{id}`
- `GET /events/timeline`
- `GET /events/hotspots`
- `GET /events/pulse`
- `GET /sources`
- `GET /jobs/status`
- `GET /jobs/logs`
- `POST /jobs/run`
- `GET/POST /alerts/rules`
- `GET /alerts/inbox`
- `POST /alerts/inbox/{alert_event_id}/ack`
- `POST /alerts/inbox/{alert_event_id}/resolve`
- `GET/POST/DELETE /queries*`

Existing APIs remain available:
- `/news`, `/markets`, `/videos`, `/watchlist`, `/alerts`, `/brief`, `/health`

## Environment Variables

- `EVENT_SCHEDULER_ENABLED` (default `1`)
- `EVENT_REFRESH_MINUTES` (default `10`)
- `EVENT_CONNECTOR_DELAY_SECONDS` (default `0.35`)
- `EVENT_DEFAULT_SINCE_HOURS` (default `48`)
- `ENABLE_OPTIONAL_CONNECTORS` (default `0`)
- `GDELT_QUERY`, `GDELT_MAX_RECORDS`
- Optional keyed connectors:
  - `ACLED_API_KEY`
  - `ACLED_EMAIL`
  - `ALPHA_VANTAGE_API_KEY`

## RSS Source Configuration

Edit `backend/app/sources_config.json`:

```json
{
  "sources": [
    {
      "name": "BBC World",
      "category": "diplomacy",
      "urls": ["https://feeds.bbci.co.uk/news/world/rss.xml"]
    }
  ]
}
```

To add a source:
1. Add a new object under `sources` with `name` and `urls`.
2. Optional: set `category` hint (`diplomacy`, `markets`, etc.).
3. Restart backend or run `POST /jobs/run`.

To remove a source:
1. Delete it from `sources`.
2. Restart backend or run `POST /jobs/run`.

## Alert Rules

Alert rules are managed from:
- UI: `/alerts`
- API: `POST /alerts/rules`

Rule conditions:
- categories
- countries/regions
- keywords
- severity threshold
- optional spike detection

Alerts flow through inbox states: `new -> acked -> resolved`.

## Tests

Run backend tests:

```powershell
cd backend
.\venv\Scripts\python.exe -m pytest -q
```

Included tests:
- Unit: RSS connector transform
- Integration: `/events` API endpoint

## Safety

See:
- `SAFETY.md`
- `SOURCES.md`
- `RUNBOOK.md`
- `DECISIONS.md`
