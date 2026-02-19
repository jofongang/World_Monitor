"""
World Monitor backend API.

Step 2 adds real RSS ingestion with caching and refresh controls.
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from app.news_service import NewsService

NEWS_CONFIG_PATH = Path(__file__).with_name("news_sources.json")
news_service = NewsService(config_path=NEWS_CONFIG_PATH)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await news_service.start()
    try:
        yield
    finally:
        await news_service.stop()


app = FastAPI(
    title="World Monitor API",
    description="Global intelligence command center backend",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MOCK_MARKETS = [
    {"symbol": "SPX", "name": "S&P 500", "price": 5842.50, "change_pct": 1.23},
    {"symbol": "DJI", "name": "Dow Jones", "price": 43150.75, "change_pct": 0.87},
    {"symbol": "IXIC", "name": "NASDAQ", "price": 18920.30, "change_pct": -0.45},
    {"symbol": "FTSE", "name": "FTSE 100", "price": 8234.10, "change_pct": 0.32},
    {"symbol": "N225", "name": "Nikkei 225", "price": 38450.00, "change_pct": -1.12},
    {"symbol": "BTC", "name": "Bitcoin", "price": 97250.00, "change_pct": 2.85},
    {"symbol": "GC", "name": "Gold", "price": 2945.30, "change_pct": 0.15},
    {"symbol": "CL", "name": "Crude Oil", "price": 78.42, "change_pct": -0.68},
]

@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/news")
def get_news(refresh: int = Query(default=0, ge=0, le=1)) -> dict:
    return news_service.get_news(force_refresh=bool(refresh))


@app.get("/markets")
def get_markets() -> dict[str, list[dict]]:
    return {"items": MOCK_MARKETS}
