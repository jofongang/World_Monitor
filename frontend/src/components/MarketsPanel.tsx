"use client";

import { useState, useEffect } from "react";
import { fetchMarkets, type MarketItem } from "@/lib/api";

/* ── Main component ────────────────────────────────────────────── */
export default function MarketsPanel() {
  const [markets, setMarkets] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMarkets()
      .then(setMarkets)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PanelSkeleton />;
  if (error) return <PanelError message={error} />;

  return (
    <div className="glow-border rounded-lg bg-panel p-4">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-accent font-mono text-sm font-bold tracking-widest uppercase">
          Markets
        </h2>
        <span className="text-muted font-mono text-[10px] tracking-wider">
          LIVE
        </span>
      </div>

      {/* ── Ticker grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        {markets.map((item) => {
          const isPositive = item.change_pct > 0;
          const changeColor = isPositive ? "text-positive" : "text-negative";
          const bgColor = isPositive
            ? "bg-positive/5 border-positive/20"
            : "bg-negative/5 border-negative/20";

          return (
            <div
              key={item.symbol}
              className={`rounded-md p-3 border transition-colors hover:border-accent/30 ${bgColor}`}
            >
              {/* Symbol + change */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted font-mono font-bold tracking-wider">
                  {item.symbol}
                </span>
                <span
                  className={`text-xs font-mono font-bold tabular-nums ${changeColor}`}
                >
                  {isPositive ? "▲" : "▼"}{" "}
                  {isPositive ? "+" : ""}
                  {item.change_pct.toFixed(2)}%
                </span>
              </div>

              {/* Name */}
              <p className="text-[11px] text-muted mt-1 truncate">
                {item.name}
              </p>

              {/* Price */}
              <p className="text-base font-mono text-foreground tabular-nums font-bold mt-1">
                {formatPrice(item.price)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Price formatting ──────────────────────────────────────────── */
function formatPrice(price: number): string {
  if (price >= 10000) {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* ── Loading skeleton ──────────────────────────────────────────── */
function PanelSkeleton() {
  return (
    <div className="glow-border rounded-lg bg-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-accent font-mono text-sm font-bold tracking-widest uppercase">
          Markets
        </h2>
        <span className="text-muted font-mono text-[10px]">LOADING...</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="bg-background/30 rounded-md h-[88px] animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

/* ── Error state ───────────────────────────────────────────────── */
function PanelError({ message }: { message: string }) {
  return (
    <div className="glow-border rounded-lg bg-panel p-4">
      <h2 className="text-accent font-mono text-sm font-bold tracking-widest uppercase mb-3">
        Markets
      </h2>
      <div className="bg-negative/5 border border-negative/30 rounded-md p-4">
        <p className="text-negative text-sm font-mono font-bold">
          ⚠ CONNECTION ERROR
        </p>
        <p className="text-muted text-xs font-mono mt-2">{message}</p>
        <p className="text-muted/50 text-[10px] font-mono mt-2">
          Ensure backend is running: uvicorn app.main:app --port 8000
        </p>
      </div>
    </div>
  );
}
