"use client";

import type { AlertItem } from "@/lib/api";

type AlertsPanelProps = {
  items: AlertItem[];
  loading: boolean;
  error: string | null;
  onlyWatchlistMatches: boolean;
  onToggleOnlyMatches: (nextValue: boolean) => void;
  onRefresh: () => void;
};

const SEVERITY_STYLES: Record<AlertItem["severity"], string> = {
  High: "bg-negative/20 text-negative border border-negative/40",
  Medium: "bg-warning/20 text-warning border border-warning/40",
  Low: "bg-accent/20 text-accent border border-accent/40",
};

export default function AlertsPanel({
  items,
  loading,
  error,
  onlyWatchlistMatches,
  onToggleOnlyMatches,
  onRefresh,
}: AlertsPanelProps) {
  return (
    <div className="glow-border rounded-lg bg-panel p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-accent font-mono text-xs font-bold uppercase tracking-widest">
            Watchlist Alerts
          </h3>
          <p className="text-muted text-[11px] font-mono mt-1">
            {items.length} alerts matched current watchlist rules
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded border border-border/70 px-2 py-1 bg-background/40">
            <input
              type="checkbox"
              checked={onlyWatchlistMatches}
              onChange={(event) => onToggleOnlyMatches(event.target.checked)}
              className="accent-[#2D7BFF]"
            />
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted">
              Only show watchlist matches
            </span>
          </label>

          <button
            type="button"
            onClick={onRefresh}
            className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded border border-accent/40 text-accent hover:bg-accent/10 transition-colors"
          >
            Refresh Alerts
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-2 rounded border border-warning/30 bg-warning/5 p-2">
          <p className="text-warning text-[11px] font-mono">Alerts refresh failed: {error}</p>
        </div>
      ) : null}

      <div className="mt-3 space-y-2 max-h-[210px] overflow-y-auto pr-1">
        {loading ? (
          Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-[56px] rounded border border-border bg-background/30 animate-pulse"
            />
          ))
        ) : items.length === 0 ? (
          <div className="rounded border border-border bg-background/30 p-3">
            <p className="text-muted text-xs font-mono">No alerts in the selected window.</p>
          </div>
        ) : (
          items.slice(0, 8).map((alert) => (
            <article
              key={alert.id}
              className="rounded border border-border bg-background/40 p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <a
                  href={alert.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-foreground hover:text-accent transition-colors leading-snug"
                >
                  {alert.title}
                </a>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full whitespace-nowrap ${SEVERITY_STYLES[alert.severity]}`}
                >
                  {alert.severity.toUpperCase()}
                </span>
              </div>

              <div className="mt-1 flex items-center gap-2 text-[10px] text-muted font-mono">
                <span>{alert.country || "Global"}</span>
                <span className="text-border">|</span>
                <span>{alert.topic}</span>
                <span className="text-border">|</span>
                <span>{formatRelativeTime(alert.published_at)}</span>
              </div>

              <div className="mt-1 text-[10px] text-muted font-mono">
                Rules: {alert.matched_rules.join(", ")}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const diffMinutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
  if (diffMinutes < 1) {
    return "<1m ago";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return `${Math.floor(diffHours / 24)}d ago`;
}
