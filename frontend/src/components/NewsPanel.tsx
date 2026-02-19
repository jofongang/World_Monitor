"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchNews, type NewsItem } from "@/lib/api";

const CATEGORY_COLORS: Record<string, string> = {
  politics: "bg-accent/20 text-accent",
  geopolitics: "bg-blue-500/20 text-blue-300",
  economy: "bg-positive/20 text-positive",
  markets: "bg-emerald-500/20 text-emerald-300",
  conflict: "bg-negative/20 text-negative",
  energy: "bg-warning/20 text-warning",
  infrastructure: "bg-cyan-500/20 text-cyan-300",
};

function getCategoryStyle(category: string): string {
  return CATEGORY_COLORS[category.toLowerCase()] ?? "bg-muted/20 text-muted";
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return "< 1m ago";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatLastUpdated(value: string | null): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
}

export default function NewsPanel() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    void loadNews(false);
  }, [loadNews]);

  if (loading) return <PanelSkeleton />;
  if (error && news.length === 0) {
    return <PanelError message={error} onRetry={() => void loadNews(true)} />;
  }

  return (
    <div className="glow-border rounded-lg bg-panel p-4 flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-accent font-mono text-sm font-bold tracking-widest uppercase">
          Intel Feed
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-muted font-mono text-[10px] tracking-wider whitespace-nowrap">
            {news.length} SIGNALS
          </span>
          <span className="text-muted/80 font-mono text-[10px] tracking-wider whitespace-nowrap">
            Last updated: {formatLastUpdated(lastUpdated)}
          </span>
          <button
            type="button"
            onClick={() => void loadNews(true)}
            disabled={refreshing}
            className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded border border-accent/40 text-accent hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-3 rounded border border-warning/30 bg-warning/5 p-2">
          <p className="text-warning text-[11px] font-mono">
            Refresh failed: {error}
          </p>
        </div>
      ) : null}

      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {news.length === 0 ? (
          <div className="rounded-md border border-border bg-background/40 p-4">
            <p className="text-muted text-xs font-mono">
              No stories available yet. Try Refresh in a moment.
            </p>
          </div>
        ) : (
          news.map((item) => (
            <article
              key={item.id}
              className="bg-background/50 border border-border rounded-md p-3 hover:border-accent/30 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-foreground font-medium leading-snug group-hover:text-accent transition-colors"
                >
                  {item.title}
                </a>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${getCategoryStyle(item.category)}`}
                  >
                    {item.category.toUpperCase()}
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-accent/10 text-accent/80 border border-accent/20">
                    SOURCE: {item.source}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2 text-[11px] text-muted font-mono">
                <span>{item.region}</span>
                <span className="text-border">|</span>
                <span>{item.country}</span>
                <span className="ml-auto text-muted/50">
                  {formatRelativeTime(item.published_at)}
                </span>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="glow-border rounded-lg bg-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-accent font-mono text-sm font-bold tracking-widest uppercase">
          Intel Feed
        </h2>
        <span className="text-muted font-mono text-[10px]">LOADING...</span>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="bg-background/30 rounded-md h-[72px] animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

function PanelError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="glow-border rounded-lg bg-panel p-4">
      <h2 className="text-accent font-mono text-sm font-bold tracking-widest uppercase mb-3">
        Intel Feed
      </h2>
      <div className="bg-negative/5 border border-negative/30 rounded-md p-4">
        <p className="text-negative text-sm font-mono font-bold">
          CONNECTION ERROR
        </p>
        <p className="text-muted text-xs font-mono mt-2">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded border border-accent/40 text-accent hover:bg-accent/10 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
