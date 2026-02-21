# World Monitor Command Center

Global intelligence command center OSINT + markets monitoring dashboard.

**Step 1**: Skeleton app with mock data, dark "Batman command-center" theme.

---

## Prerequisites

| Tool       | Version  | Check command        |
|------------|----------|----------------------|
| Node.js    | v18+     | `node --version`     |
| npm        | v9+      | `npm --version`      |
| Python     | 3.10+    | `python --version`   |

---

## Quick Start

### 1. Backend (FastAPI)

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (macOS/Linux)
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend (Next.js)

Open a **new terminal**:

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

---

## URLs

| Service          | URL                                  |
|------------------|--------------------------------------|
| Frontend         | http://localhost:3000                 |
| Dashboard        | http://localhost:3000/dashboard       |
| Events           | http://localhost:3000/events          |
| Markets          | http://localhost:3000/markets         |
| Videos           | http://localhost:3000/videos          |
| Backend Health   | http://localhost:8000/health          |
| Backend News     | http://localhost:8000/news            |
| Backend Markets  | http://localhost:8000/markets         |

---

## Verify It Works

1. **Backend health check**:
   ```bash
   curl http://localhost:8000/health
   ```
   Expected: `{"status":"ok","timestamp":"..."}`

2. **Frontend**: Open http://localhost:3000 should redirect to `/dashboard`

3. **Dashboard**: Should show:
   - Map placeholder (dark panel with SVG grid lines)
   - Markets panel (8 ticker cards with green/red colors)
   - Intel feed (10 news cards with category chips)

4. **Navigation**: Click sidebar links Events, Markets, Videos pages render

5. **Error handling**: Stop the backend panels show error messages

---

## Project Structure

```
World_Monitor/
â”œâ”€â”€ README.md
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ requirements.txt        # fastapi, uvicorn
â”‚   â””â”€â”€ app/
â”‚       â””â”€â”€ main.py             # FastAPI: /health, /news, /markets
â””â”€â”€ frontend/
    â”œâ”€â”€ package.json
    â”œâ”€â”€ tsconfig.json
    â”œâ”€â”€ next.config.ts
    â”œâ”€â”€ postcss.config.mjs
    â””â”€â”€ src/
        â”œâ”€â”€ app/
        â”‚   â”œâ”€â”€ globals.css     # Tailwind v4 theme + overlays
        â”‚   â”œâ”€â”€ layout.tsx      # Root: sidebar + header + main
        â”‚   â”œâ”€â”€ page.tsx        # Redirect â†’ /dashboard
        â”‚   â”œâ”€â”€ dashboard/
        â”‚   â”‚   â””â”€â”€ page.tsx    # Map + Markets + News grid
        â”‚   â”œâ”€â”€ events/
        â”‚   â”‚   â””â”€â”€ page.tsx    # Placeholder
        â”‚   â”œâ”€â”€ markets/
        â”‚   â”‚   â””â”€â”€ page.tsx    # MarketsPanel full page
        â”‚   â””â”€â”€ videos/
        â”‚       â””â”€â”€ page.tsx    # Placeholder
        â”œâ”€â”€ components/
        â”‚   â”œâ”€â”€ Sidebar.tsx     # Nav + filters
        â”‚   â”œâ”€â”€ HeaderBar.tsx   # Search + clock
        â”‚   â”œâ”€â”€ MapPanel.tsx    # Map placeholder
        â”‚   â”œâ”€â”€ NewsPanel.tsx   # Fetches /news
        â”‚   â””â”€â”€ MarketsPanel.tsx# Fetches /markets
        â”œâ”€â”€ lib/
        â”‚   â””â”€â”€ api.ts          # Fetch helpers + types
        â””â”€â”€ styles/
            â””â”€â”€ theme.ts        # TS color constants
```

---

## Theme

Batman / command-center / terminal aesthetic:
- **Background**: #070A12 (near-black)
- **Panels**: #0B1020 (deep navy)
- **Accent**: #2D7BFF (electric blue)
- **Text**: #E6E9F2 (high-contrast off-white)
- **Positive**: #00E676 (green â€” market up)
- **Negative**: #FF1744 (red â€” market down)

Theme constants: `frontend/src/styles/theme.ts`
CSS custom properties: `frontend/src/app/globals.css`

---

## Troubleshooting

### Port conflicts
If port 8000 or 3000 is in use:
```bash
# Backend: use different port
uvicorn app.main:app --reload --port 8001

# Frontend: set API URL env var
# Create frontend/.env.local with:
NEXT_PUBLIC_API_URL=http://localhost:8001
```

### CORS errors
The backend allows `http://localhost:3000`. If the frontend runs on a
different port, update `allow_origins` in `backend/app/main.py`.

### Python venv issues (Windows)
If `venv\Scripts\activate` fails, try:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## Next Steps (Step 2+)

- [ ] Add MapLibre GL for real world map
- [ ] Connect to RSS feeds (BBC, Reuters, Al Jazeera, etc.)
- [ ] Add GDELT event ingestion
- [ ] Add real market data (Stooq, CoinGecko, ECB)
- [ ] Add SQLite caching with SQLModel
- [ ] Add APScheduler for polling
- [ ] Add Recharts for market charts
- [ ] Add Docker Compose packaging
- [ ] Add video briefings (YouTube RSS)

---

## How to update providers safely

Markets live data is adapter-based:

- `backend/app/providers/stooq_provider.py` for ETFs/stocks/commodities
- `backend/app/providers/coingecko_provider.py` for crypto
- `backend/app/market_service.py` orchestrates adapters and cache behavior

When updating providers:

1. Keep one adapter per provider and do not bypass adapter parsing from `market_service.py`.
2. Keep strict parsing and nullable fallbacks (`price=null`, `change_pct=null`, `error` populated).
3. Keep per-provider timeout handling and never let one provider failure crash `/markets`.
4. Keep live cache at 60 seconds unless there is a strong reason to change it.
5. Verify `/health/providers` reflects health state changes.

### Provider update test steps

```bash
# backend
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000

# frontend (separate terminal)
cd frontend
npm run dev
```

Run checks:

```bash
curl http://localhost:8000/markets
curl http://localhost:8000/health/providers
curl "http://localhost:8000/markets/history?range=1m"
curl http://localhost:8000/news
```

UI checks:

1. Open `http://localhost:3000/dashboard`.
2. Change Region / Category / Time Window filters and confirm both map pins and feed update together.
3. Click map pins and verify popup fields: title, source, published_at, category, country, link.
4. Open `http://localhost:3000/markets` and verify trend range buttons still work.

---

## Part 5: Watchlists, Alerts, Daily Brief

New monitor endpoints:

- `GET /watchlist`
- `POST /watchlist`
- `GET /alerts?since_hours=24`
- `GET /brief?window=24h|7d`

### Watchlist workflow

Watchlists are persisted locally in:

- `backend/app/data/watchlist.json`

Schema:

```json
{
  "countries": ["Nigeria", "Kenya"],
  "topics": ["Conflict", "Economy"],
  "keywords": ["sanctions", "election"]
}
```

Frontend page:

- `http://localhost:3000/watchlists`

### How alerts are computed (deterministic)

An alert is created for a news item if **any** watchlist rule matches:

- country match, or
- topic match, or
- keyword match.

Severity rules:

- `High`: contains conflict/war/attack terms, or sanctions/default/coup terms.
- `Medium`: contains election/protest/strike terms.
- `Low`: all other matched alerts.

Alerts are deduped by URL (fallback: normalized title) so the same story is not emitted twice.

### Daily brief output

`GET /brief?window=24h|7d` returns:

- `generated_at`
- `window`
- `top_alerts`
- `by_region`
- `markets_snapshot`
- `one_paragraph_summary` (template-based, no LLM)

Frontend page:

- `http://localhost:3000/brief`

### Verify Part 5

Run backend and frontend:

```bash
# terminal 1
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000

# terminal 2
cd frontend
npm run dev
```

Quick API checks:

```bash
curl http://localhost:8000/watchlist
curl -X POST http://localhost:8000/watchlist -H "Content-Type: application/json" -d "{\"countries\":[\"Nigeria\"],\"topics\":[\"Conflict\"],\"keywords\":[\"sanctions\"]}"
curl "http://localhost:8000/alerts?since_hours=24"
curl "http://localhost:8000/brief?window=24h"
```

Smoke script:

```bash
cd backend
python scripts/monitor_smoke.py
```

---

## Part 6: Videos (World Briefing Channel)

Backend endpoint:

- `GET /videos`

Response shape:

```json
[
  {
    "id": "string",
    "title": "string",
    "source": "BBC News | Al Jazeera English | DW News | France 24 English | Bloomberg | CNBC",
    "url": "https://...",
    "published_at": "ISO8601",
    "topic": "Politics|Geopolitics|Economy|Markets|Conflict|Energy|Infrastructure",
    "thumbnail": "https://...|null",
    "provider": "rss|youtube_rss|youtube_api",
    "description": "string"
  }
]
```

### Source strategy (free by default)

The video service is English-first and uses free sources in order:

1. Al Jazeera English
2. BBC News (RSS, filtered to video links)
3. DW News
4. France 24 English
5. Bloomberg
6. CNBC

Implementation details:

- RSS/YouTube-feed first (`youtube.com/feeds/videos.xml?...` + BBC RSS).
- Financial Times is skipped unless an accessible feed/channel is available.
- Optional YouTube Data API v3 support is enabled only when `YOUTUBE_API_KEY` is set.
- 10-minute cache (`VIDEO_CACHE_SECONDS`, default `600`).
- Deduplication by URL (fallback title hash).
- Graceful fallback keeps cached results if one or more sources fail.

### Video configuration

Optional environment variables:

- `VIDEO_CACHE_SECONDS` (default `600`)
- `VIDEO_FETCH_TIMEOUT_SECONDS` (default `10`)
- `VIDEO_FETCH_DELAY_SECONDS` (default `0.2`)
- `VIDEO_MAX_ITEMS_PER_SOURCE` (default `10`)
- `VIDEO_MAX_ITEMS` (default `80`)
- `YOUTUBE_API_KEY` (optional)

### Verify videos

```bash
curl http://localhost:8000/videos
curl "http://localhost:8000/videos?refresh=1"
```

UI check:

- Open `http://localhost:3000/videos`
- Confirm video cards load with source/topic filters and refresh button.

Smoke check:

```bash
cd backend
python scripts/monitor_smoke.py
```
