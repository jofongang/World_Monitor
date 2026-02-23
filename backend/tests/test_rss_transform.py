from __future__ import annotations

import json
import shutil
import sys
import unittest
import uuid
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.connectors.base import HttpFetcher
from app.connectors.rss import RssConnector


class StaticXmlFetcher(HttpFetcher):
    def __init__(self, xml_payload: str) -> None:
        super().__init__(timeout_seconds=1, retries=0)
        self.xml_payload = xml_payload

    def get_xml(self, url: str) -> ET.Element:  # type: ignore[override]
        return ET.fromstring(self.xml_payload)


class RssTransformTest(unittest.TestCase):
    def test_rss_connector_normalizes_items(self) -> None:
        base_tmp = Path(__file__).resolve().parent / ".tmp"
        base_tmp.mkdir(parents=True, exist_ok=True)
        tmpdir = base_tmp / f"rss_{uuid.uuid4().hex}"
        tmpdir.mkdir(parents=True, exist_ok=True)
        try:
            config_path = tmpdir / "sources.json"
            config_path.write_text(
                json.dumps(
                    {
                        "sources": [
                            {
                                "name": "Test Source",
                                "urls": ["https://example.com/feed.xml"],
                                "category": "diplomacy",
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )

            xml_payload = """
            <rss version="2.0">
              <channel>
                <item>
                  <title>Summit talks continue in Nairobi</title>
                  <link>https://example.com/a</link>
                  <description>Diplomatic updates from Kenya</description>
                  <pubDate>Fri, 20 Feb 2026 10:00:00 GMT</pubDate>
                </item>
              </channel>
            </rss>
            """

            connector = RssConnector(
                config_path=config_path,
                fetcher=StaticXmlFetcher(xml_payload),
                max_items_per_source=10,
                request_delay_seconds=0.0,
            )
            result = connector.fetch(since_hours=200)

            self.assertIsNone(result.error)
            self.assertEqual(len(result.events), 1)
            event = result.events[0]
            self.assertEqual(event.title, "Summit talks continue in Nairobi")
            self.assertEqual(event.source, "Test Source")
            self.assertEqual(event.category, "diplomacy")
            self.assertEqual(str(event.source_url), "https://example.com/a")
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
