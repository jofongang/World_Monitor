"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import AlertsPanel from "@/components/AlertsPanel";
import MapPanel from "@/components/MapPanel";
import MarketsPanel from "@/components/MarketsPanel";
import NewsPanel from "@/components/NewsPanel";
import OperatorNotesPanel from "@/components/OperatorNotesPanel";
import TerminalLogPanel from "@/components/TerminalLogPanel";
import TimelineStrip from "@/components/TimelineStrip";
import Chip from "@/components/ui/Chip";
import Kpi from "@/components/ui/Kpi";
import Panel from "@/components/ui/Panel";
import { useCommandState } from "@/components/ui/CommandState";
import { fetchAlerts, fetchNews, type AlertItem, type NewsItem } from "@/lib/api";

export default function DashboardPage() {
  const {
    searchQuery,
    opsWindow,
    watchlistOnly,
    setWatchlistOnly,
    highSeverityOnly,
    setHighSeverityOnly,
  } = useCommandState();

  const [news, setNews] = useState<NewsItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  const [regionFilter, setRegionFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedNewsId, setSelectedNewsId] = useState<number | null>(null);

  const loadNews = useCallback(async (forceRefresh: boolean) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      setError(null);
      const payload = await fetchNews({ refresh: forceRefresh });
      setNews(payload.items);
      setLastUpdated(payload.last_updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      setAlertsError(null);
      const payload = await fetchAlerts(getSinceHours(opsWindow));
      setAlerts(payload.items);
    } catch (err) {
      setAlertsError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setAlertsLoading(false);
    }
  }, [opsWindow]);

  useEffect(() => {
    void loadNews(false);
  }, [loadNews]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const regionOptions = useMemo(() => {
    const values = Array.from(new Set(news.map((item) => item.region).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [news]);

  const categoryOptions = useMemo(() => {
    const values = Array.from(new Set(news.map((item) => item.category).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [news]);

  const highSeverityMatchKeys = useMemo(() => {
    const keys = new Set<string>();
    alerts
      .filter((item) => item.severity === "High")
      .forEach((item) => keys.add(buildAlertKey(item)));
    return keys;
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((item) => {
      if (highSeverityOnly && item.severity !== "High") {
        return false;
      }
      if (!matchesSearch(item, searchQuery)) {
        return false;
      }
      return true;
    });
  }, [alerts, highSeverityOnly, searchQuery]);

  const alertMatchKeys = useMemo(() => {
    const keys = new Set<string>();
    filteredAlerts.forEach((item) => keys.add(buildAlertKey(item)));
    return keys;
  }, [filteredAlerts]);

  const filteredNews = useMemo(() => {
    const cutoff = getTimeCutoff(opsWindow);
    const query = searchQuery.trim().toLowerCase();
    return news.filter((item) => {
      if (regionFilter !== "all" && item.region !== regionFilter) {
        return false;
      }
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }
      if (!matchesSearch(item, query)) {
        return false;
      }
      const publishedAt = new Date(item.published_at);
      if (Number.isNaN(publishedAt.getTime())) {
        return false;
      }
      return publishedAt.getTime() >= cutoff;
    });
  }, [news, regionFilter, categoryFilter, searchQuery, opsWindow]);

  const visibleNews = useMemo(() => {
    let current = filteredNews;
    if (watchlistOnly) {
      current = current.filter((item) => alertMatchKeys.has(buildNewsKey(item)));
    }
    if (highSeverityOnly) {
      current = current.filter((item) => highSeverityMatchKeys.has(buildNewsKey(item)));
    }
    return current;
  }, [filteredNews, watchlistOnly, highSeverityOnly, alertMatchKeys, highSeverityMatchKeys]);

  useEffect(() => {
    if (selectedNewsId === null) return;
    const stillVisible = visibleNews.some((item) => item.id === selectedNewsId);
    if (!stillVisible) {
      setSelectedNewsId(null);
    }
  }, [selectedNewsId, visibleNews]);

  const refreshAll = useCallback(async () => {
    await loadNews(true);
    await loadAlerts();
  }, [loadNews, loadAlerts]);

  const selectedNews = useMemo(
    () => visibleNews.find((item) => item.id === selectedNewsId) ?? null,
    [visibleNews, selectedNewsId]
  );

  return (
    <div className="space-y-4">
      <Panel
        title="Ops Controls"
        subtitle="Quick filters for map, alerts, and feed."
        contentClassName="space-y-3 px-4 pb-4"
      >
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
          <Kpi label="Signals" value={`${visibleNews.length}`} />
          <Kpi label="Alerts" value={`${filteredAlerts.length}`} />
          <Kpi
            label="Pinned"
            value={`${visibleNews.filter((item) => item.lat !== null && item.lon !== null).length}`}
          />
          <Kpi label="Window" value={opsWindow.toUpperCase()} />
          <Kpi label="Watchlist" value={watchlistOnly ? "On" : "Off"} />
          <Kpi label="Risk Filter" value={highSeverityOnly ? "High" : "All"} />
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted">
              Region
            </span>
            <Chip active={regionFilter === "all"} onClick={() => setRegionFilter("all")}>
              All
            </Chip>
            {regionOptions.map((region) => (
              <Chip
                key={region}
                active={regionFilter === region}
                onClick={() => setRegionFilter(region)}
              >
                {region}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted">
              Category
            </span>
            <Chip active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>
              All
            </Chip>
            {categoryOptions.map((category) => (
              <Chip
                key={category}
                active={categoryFilter === category}
                onClick={() => setCategoryFilter(category)}
              >
                {category}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted">
              Toggles
            </span>
            <Chip active={watchlistOnly} onClick={() => setWatchlistOnly((value) => !value)}>
              Watchlist-only
            </Chip>
            <Chip active={highSeverityOnly} onClick={() => setHighSeverityOnly((value) => !value)}>
              High Severity
            </Chip>
            <Chip onClick={() => void refreshAll()} disabled={refreshing}>
              {refreshing ? "Refreshing..." : "Refresh All"}
            </Chip>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <MapPanel
            items={visibleNews}
            loading={loading}
            error={error}
            selectedNewsId={selectedNewsId}
            onSelectNews={setSelectedNewsId}
          />
        </div>

        <div className="flex flex-col gap-4 xl:col-span-2">
          <AlertsPanel
            items={filteredAlerts}
            loading={alertsLoading}
            error={alertsError}
            onlyWatchlistMatches={watchlistOnly}
            onToggleOnlyMatches={setWatchlistOnly}
            onRefresh={() => void loadAlerts()}
          />

          <NewsPanel
            items={visibleNews}
            lastUpdated={lastUpdated}
            loading={loading}
            refreshing={refreshing}
            error={error}
            onRefresh={() => void refreshAll()}
            selectedNewsId={selectedNewsId}
            onSelectNews={setSelectedNewsId}
          />

          <MarketsPanel dense />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TimelineStrip sinceHours={getSinceHours(opsWindow)} />
        </div>
        <Panel
          title="Intel Card"
          subtitle="Selected feed item details"
          contentClassName="space-y-2 px-4 pb-4"
        >
          {selectedNews ? (
            <>
              <h3 className="text-sm text-foreground leading-snug">{selectedNews.title}</h3>
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-muted">
                <span>{selectedNews.source}</span>
                <span>|</span>
                <span>{selectedNews.country || "Global"}</span>
                <span>|</span>
                <span>{selectedNews.region}</span>
                <span>|</span>
                <span>{formatRelativeTime(selectedNews.published_at)}</span>
              </div>
              <a
                href={selectedNews.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded border border-accent/40 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-accent hover:bg-accent/10"
              >
                Open Source
              </a>
            </>
          ) : (
            <p className="text-xs font-mono text-muted">
              Select an item from the feed to inspect details.
            </p>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OperatorNotesPanel />
        <TerminalLogPanel dense />
      </div>
    </div>
  );
}

function getTimeCutoff(windowValue: "1h" | "6h" | "24h" | "7d" | "30d"): number {
  const now = Date.now();
  if (windowValue === "1h") return now - 1 * 60 * 60 * 1000;
  if (windowValue === "6h") return now - 6 * 60 * 60 * 1000;
  if (windowValue === "24h") return now - 24 * 60 * 60 * 1000;
  if (windowValue === "7d") return now - 7 * 24 * 60 * 60 * 1000;
  return now - 30 * 24 * 60 * 60 * 1000;
}

function getSinceHours(windowValue: "1h" | "6h" | "24h" | "7d" | "30d"): number {
  if (windowValue === "1h") return 1;
  if (windowValue === "6h") return 6;
  if (windowValue === "24h") return 24;
  if (windowValue === "7d") return 7 * 24;
  return 30 * 24;
}

function buildNewsKey(item: NewsItem): string {
  const url = item.url.trim().toLowerCase();
  if (url) return `url:${url}`;
  return `title:${normalizeText(item.title)}`;
}

function buildAlertKey(item: AlertItem): string {
  const url = item.url.trim().toLowerCase();
  if (url) return `url:${url}`;
  return `title:${normalizeText(item.title)}`;
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "unknown";
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
  if (diffMinutes < 1) return "<1m ago";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function matchesSearch(
  item: Pick<NewsItem, "title" | "source" | "country" | "region" | "category">,
  query: string
): boolean;
function matchesSearch(
  item: Pick<AlertItem, "title" | "topic" | "country">,
  query: string
): boolean;
function matchesSearch(
  item:
    | Pick<NewsItem, "title" | "source" | "country" | "region" | "category">
    | Pick<AlertItem, "title" | "topic" | "country">,
  query: string
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const candidate = [
    "title" in item ? item.title : "",
    "source" in item ? item.source : "",
    "region" in item ? item.region : "",
    "category" in item ? item.category : "",
    "topic" in item ? item.topic : "",
    item.country,
  ]
    .join(" ")
    .toLowerCase();
  return candidate.includes(normalized);
}
