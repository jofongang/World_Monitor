"""
World Monitor backend API.

Step 2 adds real RSS ingestion with caching and refresh controls.
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from app.market_service import MarketService
from app.news_service import NewsService

NEWS_CONFIG_PATH = Path(__file__).with_name("news_sources.json")
news_service = NewsService(config_path=NEWS_CONFIG_PATH)
market_service = MarketService()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await news_service.start()
    market_service.refresh(force=True)
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


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/news")
def get_news(refresh: int = Query(default=0, ge=0, le=1)) -> dict:
    return news_service.get_news(force_refresh=bool(refresh))


@app.get("/markets")
def get_markets() -> dict[str, list[dict]]:
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
