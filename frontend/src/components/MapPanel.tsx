"use client";

import dynamic from "next/dynamic";

import Panel from "@/components/ui/Panel";
import type { NewsItem } from "@/lib/api";

const WorldNewsMap = dynamic(() => import("@/components/WorldNewsMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[520px] items-center justify-center px-4 text-muted font-mono text-xs">
      Initializing geospatial layer...
    </div>
  ),
});

type MapPanelProps = {
  items: NewsItem[];
  loading: boolean;
  error: string | null;
  selectedNewsId: number | null;
  onSelectNews: (id: number | null) => void;
};

export default function MapPanel({
  items,
  loading,
  error,
  selectedNewsId,
  onSelectNews,
}: MapPanelProps) {
  const pinCount = items.filter((item) => item.lat !== null && item.lon !== null).length;
  const selectedItem = items.find((item) => item.id === selectedNewsId) ?? null;

  return (
    <Panel
      title="Global Situation Map"
      subtitle="Geo-clustered news events. Select a feed item to highlight location."
      rightSlot={
        <span className="text-[10px] font-mono text-muted tracking-wider">
          {pinCount} pinned
        </span>
      }
      className="h-full min-h-[590px]"
      contentClassName="px-4 pb-4"
    >
      {error ? (
        <div className="mb-2 rounded border border-warning/35 bg-warning/10 px-2.5 py-2">
          <p className="text-warning text-[11px] font-mono">Data warning: {error}</p>
        </div>
      ) : null}

      <div className="mb-2 flex items-center justify-between text-[10px] font-mono text-muted">
        <span>
          {selectedItem
            ? `Selected: ${selectedItem.country} ${selectedItem.location_label ? `(${selectedItem.location_label})` : ""}`
            : "Selected: none"}
        </span>
        <button
          type="button"
          onClick={() => onSelectNews(null)}
          className="rounded border border-border px-2 py-1 text-muted hover:text-foreground hover:border-accent/40"
        >
          Clear
        </button>
      </div>

      {loading ? (
        <div className="flex h-[520px] items-center justify-center px-4 text-muted font-mono text-xs">
          Loading map data...
        </div>
      ) : (
        <div className="h-[520px] overflow-hidden rounded-md">
          <WorldNewsMap
            items={items}
            selectedNewsId={selectedNewsId}
            onSelectNews={onSelectNews}
          />
        </div>
      )}
    </Panel>
  );
}
