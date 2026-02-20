"use client";

import Badge from "@/components/ui/Badge";
import Panel from "@/components/ui/Panel";
import type { AlertItem } from "@/lib/api";

type AlertsPanelProps = {
  items: AlertItem[];
  loading: boolean;
  error: string | null;
  onlyWatchlistMatches: boolean;
  onToggleOnlyMatches: (nextValue: boolean) => void;
  onRefresh: () => void;
};

const SEVERITY_MAP: Record<AlertItem["severity"], "high" | "medium" | "low"> = {
  High: "high",
  Medium: "medium",
  Low: "low",
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
    <Panel
      title="Watchlist Alerts"
      subtitle="Rule-triggered events from monitored countries/topics."
      rightSlot={
        <div className="flex items-center gap-1.5">
          <label className="inline-flex items-center gap-1 rounded border border-border/70 bg-background/45 px-2 py-1">
            <input
              type="checkbox"
              checked={onlyWatchlistMatches}
              onChange={(event) => onToggleOnlyMatches(event.target.checked)}
              className="accent-[#2D7BFF]"
            />
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted">
              Matches
            </span>
          </label>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded border border-accent/40 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-accent hover:bg-accent/10"
          >
            Refresh
          </button>
        </div>
      }
      className="min-h-[230px]"
      contentClassName="px-4 pb-4"
    >
      {error ? (
        <div className="mb-2 rounded border border-warning/35 bg-warning/10 p-2">
          <p className="text-warning text-[11px] font-mono">Alerts refresh warning: {error}</p>
        </div>
      ) : null}

      <div className="terminal-scroll space-y-2 max-h-[215px] overflow-y-auto pr-1">
        {loading ? (
          Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-[56px] rounded border border-border bg-background/30 animate-pulse"
            />
          ))
        ) : items.length === 0 ? (
          <div className="rounded border border-border bg-background/40 p-3">
            <p className="text-muted text-xs font-mono">No alerts in this window.</p>
          </div>
        ) : (
          items.slice(0, 8).map((alert) => (
            <article key={alert.id} className="rounded border border-border bg-background/45 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <a
                  href={alert.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-foreground hover:text-accent transition-colors leading-snug"
                >
                  {alert.title}
                </a>
                <Badge severity={SEVERITY_MAP[alert.severity]} />
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted font-mono">
                <span className="text-accent-soft">Watchlist Engine</span>
                <span>|</span>
                <span>{alert.country || "Global"}</span>
                <span>|</span>
                <span>{alert.topic}</span>
                <span>|</span>
                <span>{formatRelativeTime(alert.published_at)}</span>
              </div>
            </article>
          ))
        )}
      </div>
    </Panel>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
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
