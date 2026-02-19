# World Monitor — Command Center

Global intelligence command center — OSINT + markets monitoring dashboard.

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

2. **Frontend**: Open http://localhost:3000 — should redirect to `/dashboard`

3. **Dashboard**: Should show:
   - Map placeholder (dark panel with SVG grid lines)
   - Markets panel (8 ticker cards with green/red colors)
   - Intel feed (10 news cards with category chips)

4. **Navigation**: Click sidebar links → Events, Markets, Videos pages render

5. **Error handling**: Stop the backend → panels show error messages

---

## Project Structure

```
World_Monitor/
├── README.md
├── backend/
│   ├── requirements.txt        # fastapi, uvicorn
│   └── app/
│       └── main.py             # FastAPI: /health, /news, /markets
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── postcss.config.mjs
    └── src/
        ├── app/
        │   ├── globals.css     # Tailwind v4 theme + overlays
        │   ├── layout.tsx      # Root: sidebar + header + main
        │   ├── page.tsx        # Redirect → /dashboard
        │   ├── dashboard/
        │   │   └── page.tsx    # Map + Markets + News grid
        │   ├── events/
        │   │   └── page.tsx    # Placeholder
        │   ├── markets/
        │   │   └── page.tsx    # MarketsPanel full page
        │   └── videos/
        │       └── page.tsx    # Placeholder
        ├── components/
        │   ├── Sidebar.tsx     # Nav + filters
        │   ├── HeaderBar.tsx   # Search + clock
        │   ├── MapPanel.tsx    # Map placeholder
        │   ├── NewsPanel.tsx   # Fetches /news
        │   └── MarketsPanel.tsx# Fetches /markets
        ├── lib/
        │   └── api.ts          # Fetch helpers + types
        └── styles/
            └── theme.ts        # TS color constants
```

---

## Theme

Batman / command-center / terminal aesthetic:
- **Background**: #070A12 (near-black)
- **Panels**: #0B1020 (deep navy)
- **Accent**: #2D7BFF (electric blue)
- **Text**: #E6E9F2 (high-contrast off-white)
- **Positive**: #00E676 (green — market up)
- **Negative**: #FF1744 (red — market down)

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
