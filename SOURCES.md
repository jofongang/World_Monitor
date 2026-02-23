# Sources and Attribution

This project uses public OSINT-style data sources for situational awareness.

## Free Connectors (enabled by default)

1. USGS Earthquakes
- URL: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/*.geojson`
- Usage: earthquake events (category `disaster`)
- Notes: public feed, attribution to USGS.

2. NASA EONET
- URL: `https://eonet.gsfc.nasa.gov/api/v3/events`
- Usage: natural event incidents (category `disaster`)
- Notes: public API, attribution to NASA EONET.

3. GDELT Doc API
- URL: `https://api.gdeltproject.org/api/v2/doc/doc`
- Usage: article-level global events (category inferred)
- Notes: public API availability can vary; degraded mode supported.

4. RSS/Atom (English-first)
- Config: `backend/app/sources_config.json`
- Defaults:
  - BBC World RSS
  - Al Jazeera English RSS
  - UN News RSS
  - IMF RSS
  - World Bank Atom/RSS
  - AfDB RSS
- Usage: general geopolitical/economic event feed.

## Optional Key-Based Connectors (stubs behind flags)

- ACLED (requires `ACLED_API_KEY` + `ACLED_EMAIL`)
- Market Overlay key connector (requires `ALPHA_VANTAGE_API_KEY`)

## Attribution and Compliance Notes

- Use official APIs/RSS endpoints where possible.
- Do not scrape sites that disallow automated collection.
- Respect each source’s usage terms and request-rate limits.
