"use client";

import dynamic from "next/dynamic";
import type { NewsItem } from "@/lib/api";

const WorldNewsMap = dynamic(() => import("@/components/WorldNewsMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center text-muted font-mono text-xs">
      Initializing map...
    </div>
  ),
});

type MapPanelProps = {
  items: NewsItem[];
  loading: boolean;
  error: string | null;
};

export default function MapPanel({ items, loading, error }: MapPanelProps) {
  const pinCount = items.filter((item) => item.lat !== null && item.lon !== null).length;

  return (
    <div className="glow-border rounded-lg bg-panel min-h-[420px] relative overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <h2 className="text-accent font-mono text-sm font-bold tracking-widest uppercase">
            Global Situation Map
          </h2>
          <p className="text-muted text-[11px] font-mono mt-1">
            Geo-tagged events from current intel feed
          </p>
        </div>
        <span className="text-muted font-mono text-[10px] tracking-wider">
          {pinCount} PINNED
        </span>
      </div>

      {error ? (
        <div className="mx-4 mb-3 rounded border border-warning/30 bg-warning/5 p-2">
          <p className="text-warning text-[11px] font-mono">
            Data warning: {error}
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex h-[360px] items-center justify-center text-muted font-mono text-xs px-4">
          Loading map data...
        </div>
      ) : (
        <div className="h-[360px] px-3 pb-3">
          <WorldNewsMap items={items} />
        </div>
      )}
    </div>
  );
}
