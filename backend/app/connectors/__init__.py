"""Public-data connector adapters for event ingestion."""

from app.connectors.base import ConnectorResult, EventConnector
from app.connectors.eonet import EonetConnector
from app.connectors.gdelt import GdeltConnector
from app.connectors.rss import RssConnector
from app.connectors.usgs import UsgsConnector

__all__ = [
    "ConnectorResult",
    "EventConnector",
    "EonetConnector",
    "GdeltConnector",
    "RssConnector",
    "UsgsConnector",
]
