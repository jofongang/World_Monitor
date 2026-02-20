"use client";

import { useEffect, useState } from "react";
import { fetchMarkets, type MarketItem } from "@/lib/api";

export default function MarketsPanel() {
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

  if (loading) return <PanelSkeleton />;
  if (error) return <PanelError message={error} />;

  return (
    <div className="glow-border rounded-lg bg-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-accent font-mono text-sm font-bold tracking-widest uppercase">
          Markets
        </h2>
        <span className="text-muted font-mono text-[10px] tracking-wider">LIVE</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {markets.map((item) => {
          const isPositive = item.change_pct !== null && item.change_pct > 0;
          const hasChange = item.change_pct !== null;

          const changeColor = hasChange
            ? isPositive
              ? "text-positive"
              : "text-negative"
            : "text-muted";

          const bgColor = hasChange
            ? isPositive
              ? "bg-positive/5 border-positive/20"
              : "bg-negative/5 border-negative/20"
            : "bg-background/25 border-border";

          return (
            <div
              key={item.symbol}
              className={`rounded-md p-3 border transition-colors hover:border-accent/30 ${bgColor}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs text-muted font-mono font-bold tracking-wider">
                    {item.symbol}
                  </span>
                  <p className="text-[11px] text-muted mt-1 truncate">{item.name}</p>
                </div>
                <span className={`text-xs font-mono font-bold tabular-nums ${changeColor}`}>
                  {formatChange(item.change_pct)}
                </span>
              </div>

              <p className="text-base font-mono text-foreground tabular-nums font-bold mt-1">
                {formatPrice(item.price)}
              </p>

              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono text-muted uppercase tracking-wide">
                  {item.provider}
                </span>
                <span className="text-[10px] font-mono text-muted/80">
                  {formatAsOf(item.as_of)}
                </span>
              </div>

              {item.error ? (
                <p className="mt-1 text-[10px] font-mono text-warning/90 truncate" title={item.error}>
                  {item.error}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
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
  const arrow = positive ? "▲" : changePct < 0 ? "▼" : "•";
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

function PanelSkeleton() {
  return (
    <div className="glow-border rounded-lg bg-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-accent font-mono text-sm font-bold tracking-widest uppercase">
          Markets
        </h2>
        <span className="text-muted font-mono text-[10px]">LOADING...</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="bg-background/30 rounded-md h-[110px] animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function PanelError({ message }: { message: string }) {
  return (
    <div className="glow-border rounded-lg bg-panel p-4">
      <h2 className="text-accent font-mono text-sm font-bold tracking-widest uppercase mb-3">
        Markets
      </h2>
      <div className="bg-negative/5 border border-negative/30 rounded-md p-4">
        <p className="text-negative text-sm font-mono font-bold">CONNECTION ERROR</p>
        <p className="text-muted text-xs font-mono mt-2">{message}</p>
        <p className="text-muted/50 text-[10px] font-mono mt-2">
          Ensure backend is running: uvicorn app.main:app --port 8000
        </p>
      </div>
    </div>
  );
}
