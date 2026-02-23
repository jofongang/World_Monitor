"use client";

import { useEffect, useMemo, useState } from "react";

import Panel from "@/components/ui/Panel";
import type { MarketItem } from "@/lib/api";
import { fetchMarkets } from "@/lib/api";

type MarketsPanelProps = {
  dense?: boolean;
};

export default function MarketsPanel({ dense = false }: MarketsPanelProps) {
  const [markets, setMarkets] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMarkets()
      .then(setMarkets)
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Unexpected error";
        setError(message);
      })
      .finally(() => setLoading(false));
  }, []);

  const lastUpdated = useMemo(() => {
    if (markets.length === 0) {
      return "Unknown";
    }
    const latest = markets
      .map((item) => new Date(item.as_of))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    if (!latest) {
      return "Unknown";
    }

    return latest.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "short",
    });
  }, [markets]);

  if (loading) return <PanelSkeleton dense={dense} />;
  if (error) return <PanelError message={error} dense={dense} />;

  return (
    <Panel
      title="Markets"
      subtitle={`Last updated ${lastUpdated}`}
      rightSlot={<span className="text-[10px] font-mono text-positive tracking-wider">Live</span>}
      className={dense ? "min-h-[260px]" : ""}
      contentClassName="px-4 pb-4"
    >
      <div className={`grid gap-2 ${dense ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
        {markets.map((item) => {
          const isPositive = item.change_pct !== null && item.change_pct > 0;
          const hasChange = item.change_pct !== null;

          const changeColor = hasChange
            ? isPositive
              ? "text-positive"
              : "text-danger"
            : "text-muted";

          const bgColor = hasChange
            ? isPositive
              ? "bg-positive/6 border-positive/24"
              : "bg-danger/6 border-danger/24"
            : "bg-background/25 border-border";

          return (
            <div
              key={item.symbol}
              className={`rounded-md border p-2.5 transition-colors hover:border-accent/35 ${bgColor}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs text-muted font-mono font-bold tracking-wider">
                    {item.symbol}
                  </span>
                  <p className="mt-1 truncate text-[11px] text-muted">{item.name}</p>
                </div>
                <span className={`text-xs font-mono font-bold tabular-nums ${changeColor}`}>
                  {formatChange(item.change_pct)}
                </span>
              </div>

              <p className="mt-1 text-base font-mono font-bold tabular-nums text-foreground">
                {formatPrice(item.price)}
              </p>

              <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] font-mono text-muted">
                <span>{item.provider}</span>
                <span>{formatAsOf(item.as_of)}</span>
              </div>

              {item.error ? (
                <p className="mt-1 truncate text-[10px] font-mono text-warning/90" title={item.error}>
                  {item.error}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function formatPrice(price: number | null): string {
  if (price === null || Number.isNaN(price)) {
    return "N/A";
  }
  return price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function formatChange(changePct: number | null): string {
  if (changePct === null || Number.isNaN(changePct)) {
    return "N/A";
  }
  const positive = changePct > 0;
  const arrow = positive ? "+" : changePct < 0 ? "-" : "~";
  return `${arrow} ${positive ? "+" : ""}${changePct.toFixed(2)}%`;
}

function formatAsOf(asOf: string): string {
  const parsed = new Date(asOf);
  if (Number.isNaN(parsed.getTime())) {
    return asOf;
  }
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function PanelSkeleton({ dense }: { dense: boolean }) {
  return (
    <Panel
      title="Markets"
      subtitle="Loading market feed..."
      className={dense ? "min-h-[260px]" : ""}
      contentClassName="px-4 pb-4"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {Array.from({ length: dense ? 4 : 8 }, (_, i) => (
          <div key={i} className="h-[106px] animate-pulse rounded-md bg-background/35" />
        ))}
      </div>
    </Panel>
  );
}

function PanelError({ message, dense }: { message: string; dense: boolean }) {
  return (
    <Panel
      title="Markets"
      subtitle="Connection issue"
      className={dense ? "min-h-[260px]" : ""}
      contentClassName="px-4 pb-4"
    >
      <div className="rounded-md border border-danger/35 bg-danger/10 p-3">
        <p className="text-danger text-sm font-mono font-bold">Connection error</p>
        <p className="mt-2 text-xs font-mono text-muted">{message}</p>
      </div>
    </Panel>
  );
}

