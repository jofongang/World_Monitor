"use client";

import Panel from "@/components/ui/Panel";
import type { NewsItem } from "@/lib/api";

type NewsPanelProps = {
  items: NewsItem[];
  lastUpdated: string | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRefresh: () => void;
  selectedNewsId: number | null;
  onSelectNews: (id: number) => void;
};

const CATEGORY_COLORS: Record<string, string> = {
  politics: "bg-accent/20 text-accent border border-accent/30",
  geopolitics: "bg-accent-soft/15 text-accent-soft border border-accent-soft/30",
  economy: "bg-positive/15 text-positive border border-positive/35",
  markets: "bg-positive/15 text-positive border border-positive/35",
  conflict: "bg-danger/20 text-danger border border-danger/45",
  energy: "bg-warning/18 text-warning border border-warning/38",
  infrastructure: "bg-accent/20 text-accent border border-accent/30",
};

function getCategoryStyle(category: string): string {
  return CATEGORY_COLORS[category.toLowerCase()] ?? "bg-muted/20 text-muted border border-border";
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "unknown";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return "<1m ago";
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
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
}

export default function NewsPanel({
  items,
  lastUpdated,
  loading,
  refreshing,
  error,
  onRefresh,
  selectedNewsId,
  onSelectNews,
}: NewsPanelProps) {
  if (loading) return <PanelSkeleton />;
  if (error && items.length === 0) {
    return <PanelError message={error} onRetry={onRefresh} />;
  }

  return (
    <Panel
      title="Intel Feed"
      subtitle={`Last updated ${formatLastUpdated(lastUpdated)}`}
      rightSlot={
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted tracking-wider">
            {items.length} signals
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="rounded border border-accent/40 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-accent hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      }
      className="h-full min-h-[320px] xl:min-h-[340px]"
      contentClassName="px-4 pb-4"
    >
      {error ? (
        <div className="mb-2 rounded border border-warning/35 bg-warning/10 p-2">
          <p className="text-warning text-[11px] font-mono">Refresh warning: {error}</p>
        </div>
      ) : null}

      <div className="terminal-scroll space-y-2 max-h-[330px] overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="rounded-md border border-border bg-background/45 p-4">
            <p className="text-muted text-xs font-mono">
              No stories match active controls.
            </p>
          </div>
        ) : (
          items.map((item) => {
            const selected = selectedNewsId === item.id;
            return (
              <article
                key={item.id}
                className={`rounded-md border p-3 transition-colors ${
                  selected
                    ? "border-warning/55 bg-warning/10"
                    : "border-border bg-background/45 hover:border-accent/38"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectNews(item.id)}
                    className="text-left text-sm text-foreground leading-snug hover:text-accent transition-colors"
                  >
                    {item.title}
                  </button>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide ${getCategoryStyle(item.category)}`}
                  >
                    {item.category}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-muted">
                  <span className="text-accent-soft">{item.source}</span>
                  <span>|</span>
                  <span>{item.country || "Global"}</span>
                  <span>|</span>
                  <span>{item.region}</span>
                  <span>|</span>
                  <span>{formatRelativeTime(item.published_at)}</span>
                  <span className="ml-auto">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-border px-1.5 py-0.5 text-muted hover:border-accent/40 hover:text-accent"
                    >
                      Source
                    </a>
                  </span>
                </div>
              </article>
            );
          })
        )}
      </div>
    </Panel>
  );
}

function PanelSkeleton() {
  return (
    <Panel
      title="Intel Feed"
      subtitle="Loading signals..."
      className="h-full min-h-[320px]"
      contentClassName="px-4 pb-4"
    >
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-[74px] animate-pulse rounded-md bg-background/30" />
        ))}
      </div>
    </Panel>
  );
}

function PanelError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Panel
      title="Intel Feed"
      subtitle="Connection issue"
      className="h-full min-h-[320px]"
      contentClassName="px-4 pb-4"
    >
      <div className="rounded-md border border-danger/35 bg-danger/10 p-3">
        <p className="text-danger text-sm font-mono font-bold">Connection error</p>
        <p className="mt-2 text-xs font-mono text-muted">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded border border-accent/40 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-accent hover:bg-accent/10"
        >
          Retry
        </button>
      </div>
    </Panel>
  );
}
