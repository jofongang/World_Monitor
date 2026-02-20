"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import AlertsPanel from "@/components/AlertsPanel";
import MapPanel from "@/components/MapPanel";
import MarketsPanel from "@/components/MarketsPanel";
import NewsPanel from "@/components/NewsPanel";
import { fetchAlerts, fetchNews, type AlertItem, type NewsItem } from "@/lib/api";

type TimeWindow = "24h" | "7d" | "30d";

const TIME_WINDOW_OPTIONS: Array<{ value: TimeWindow; label: string }> = [
  { value: "24h", label: "Last 24h" },
  { value: "7d", label: "Last 7d" },
  { value: "30d", label: "Last 30d" },
];

export default function DashboardPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [onlyWatchlistMatches, setOnlyWatchlistMatches] = useState(false);

  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("7d");

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
      const message = err instanceof Error ? err.message : "Unexpected error";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      setAlertsError(null);
      const sinceHours = getSinceHours(timeWindow);
      const payload = await fetchAlerts(sinceHours);
      setAlerts(payload.items);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      setAlertsError(message);
    } finally {
      setAlertsLoading(false);
    }
  }, [timeWindow]);

  useEffect(() => {
    void loadNews(false);
  }, [loadNews]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const regionOptions = useMemo(() => {
    const values = Array.from(
      new Set(news.map((item) => item.region).filter((value) => value && value.trim().length > 0))
    );
    values.sort((a, b) => a.localeCompare(b));
    return values;
  }, [news]);

  const categoryOptions = useMemo(() => {
    const values = Array.from(
      new Set(news.map((item) => item.category).filter((value) => value && value.trim().length > 0))
    );
    values.sort((a, b) => a.localeCompare(b));
    return values;
  }, [news]);

  const filteredNews = useMemo(() => {
    const cutoff = getTimeCutoff(timeWindow);

    return news.filter((item) => {
      if (regionFilter !== "all" && item.region !== regionFilter) {
        return false;
      }

      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }

      const publishedAt = new Date(item.published_at);
      if (Number.isNaN(publishedAt.getTime())) {
        return false;
      }

      return publishedAt.getTime() >= cutoff;
    });
  }, [news, regionFilter, categoryFilter, timeWindow]);

  const alertMatchKeys = useMemo(() => {
    const keys = new Set<string>();
    alerts.forEach((item) => {
      keys.add(buildAlertKey(item));
    });
    return keys;
  }, [alerts]);

  const visibleNews = useMemo(() => {
    if (!onlyWatchlistMatches) {
      return filteredNews;
    }

    return filteredNews.filter((item) => alertMatchKeys.has(buildNewsKey(item)));
  }, [filteredNews, onlyWatchlistMatches, alertMatchKeys]);

  const refreshAll = useCallback(async () => {
    await loadNews(true);
    await loadAlerts();
  }, [loadNews, loadAlerts]);

  return (
    <div className="space-y-4 h-full">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <MapPanel items={visibleNews} loading={loading} error={error} />
        </div>
        <div>
          <MarketsPanel />
        </div>
      </div>

      <div className="glow-border rounded-lg bg-panel p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-accent font-mono text-xs font-bold uppercase tracking-widest">
              Intel Filters
            </h3>
            <p className="text-muted text-[11px] font-mono mt-1">
              Filters apply to both map pins and feed cards
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full md:max-w-3xl">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted">
                Region
              </span>
              <select
                value={regionFilter}
                onChange={(event) => setRegionFilter(event.target.value)}
                className="bg-background border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
              >
                <option value="all">All regions</option>
                {regionOptions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted">
                Category
              </span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="bg-background border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
              >
                <option value="all">All categories</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted">
                Time Window
              </span>
              <select
                value={timeWindow}
                onChange={(event) => setTimeWindow(event.target.value as TimeWindow)}
                className="bg-background border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
              >
                {TIME_WINDOW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <AlertsPanel
        items={alerts}
        loading={alertsLoading}
        error={alertsError}
        onlyWatchlistMatches={onlyWatchlistMatches}
        onToggleOnlyMatches={setOnlyWatchlistMatches}
        onRefresh={() => void loadAlerts()}
      />

      <NewsPanel
        items={visibleNews}
        lastUpdated={lastUpdated}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onRefresh={() => void refreshAll()}
      />
    </div>
  );
}

function getTimeCutoff(windowValue: TimeWindow): number {
  const now = Date.now();
  if (windowValue === "24h") {
    return now - 24 * 60 * 60 * 1000;
  }
  if (windowValue === "7d") {
    return now - 7 * 24 * 60 * 60 * 1000;
  }
  return now - 30 * 24 * 60 * 60 * 1000;
}

function getSinceHours(windowValue: TimeWindow): number {
  if (windowValue === "24h") {
    return 24;
  }
  if (windowValue === "7d") {
    return 7 * 24;
  }
  return 30 * 24;
}

function buildNewsKey(item: NewsItem): string {
  const url = item.url.trim().toLowerCase();
  if (url) {
    return `url:${url}`;
  }
  return `title:${normalizeText(item.title)}`;
}

function buildAlertKey(item: AlertItem): string {
  const url = item.url.trim().toLowerCase();
  if (url) {
    return `url:${url}`;
  }
  return `title:${normalizeText(item.title)}`;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
