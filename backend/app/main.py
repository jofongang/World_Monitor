"""
World Monitor backend API.

Step 2 adds real RSS ingestion with caching and refresh controls.
"""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api import create_ops_router
from app.alert_service import AlertService
from app.brief_service import BriefService
from app.data.event_store import EventStore
from app.jobs import EventIngestionService
from app.market_service import MarketService
from app.news_service import NewsService
from app.video_service import VideoService
from app.watchlist_service import WatchlistService

NEWS_CONFIG_PATH = Path(__file__).with_name("news_sources.json")
SOURCES_CONFIG_PATH = Path(__file__).with_name("sources_config.json")
WATCHLIST_PATH = Path(__file__).resolve().parent / "data" / "watchlist.json"
EVENT_DB_PATH = Path(__file__).resolve().parent / "data" / "world_monitor.db"

news_service = NewsService(config_path=NEWS_CONFIG_PATH)
market_service = MarketService()
video_service = VideoService()
watchlist_service = WatchlistService(storage_path=WATCHLIST_PATH)
event_store = EventStore(db_path=EVENT_DB_PATH)
ingestion_service = EventIngestionService(
    store=event_store,
    rss_config_path=SOURCES_CONFIG_PATH,
)
alert_service = AlertService(
    news_service=news_service,
    watchlist_service=watchlist_service,
)
brief_service = BriefService(
    news_service=news_service,
    market_service=market_service,
    alert_service=alert_service,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await news_service.start()
    await ingestion_service.start()
    market_service.refresh_async(force=True)
    video_service.refresh_async(force=True)
    try:
        yield
    finally:
        await ingestion_service.stop()
        await news_service.stop()


app = FastAPI(
    title="World Monitor API",
    description="Global intelligence command center backend",
    version="0.6.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid4()))
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    return response


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/providers")
def provider_health() -> dict[str, dict[str, object]]:
    return market_service.get_provider_health()


@app.get("/news")
def get_news(refresh: int = Query(default=0, ge=0, le=1)) -> dict:
    return news_service.get_news(force_refresh=bool(refresh))


@app.get("/videos")
def get_videos(refresh: int = Query(default=0, ge=0, le=1)) -> list[dict[str, Any]]:
    return video_service.get_videos(force_refresh=bool(refresh))


@app.get("/markets")
def get_markets() -> list[dict[str, Any]]:
    return market_service.get_markets()


@app.get("/markets/history")
def get_markets_history(
    range_key: str = Query(
        default="1m",
        alias="range",
        pattern="^(24h|7d|1m|6m|1y|5y)$",
    )
) -> dict:
    return market_service.get_market_history(range_key=range_key)


@app.get("/watchlist")
def get_watchlist() -> dict[str, list[str]]:
    return watchlist_service.get_watchlist()


@app.post("/watchlist")
def update_watchlist(payload: dict[str, Any]) -> dict[str, list[str]]:
    return watchlist_service.update_watchlist(payload)


@app.get("/alerts")
def get_alerts(since_hours: int = Query(default=24, ge=1, le=24 * 30)) -> dict[str, Any]:
    return alert_service.get_alerts(since_hours=since_hours)


@app.get("/brief")
def get_brief(
    window: str = Query(default="24h", pattern="^(24h|7d)$")
) -> dict[str, Any]:
    return brief_service.get_brief(window=window)


app.include_router(
    create_ops_router(
        store=event_store,
        ingestion_service=ingestion_service,
    )
)
