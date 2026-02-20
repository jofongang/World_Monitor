"use client";

import { useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import type { NewsItem } from "@/lib/api";

type WorldNewsMapProps = {
  items: NewsItem[];
};

type PinCluster = {
  key: string;
  label: string;
  country: string;
  lat: number;
  lon: number;
  items: NewsItem[];
};

const DEFAULT_CENTER: [number, number] = [18, 8];
const DEFAULT_ZOOM = 2;
const MAX_POPUP_ITEMS = 6;

export default function WorldNewsMap({ items }: WorldNewsMapProps) {
  const [tileError, setTileError] = useState(false);

  const clusters = useMemo(() => buildClusters(items), [items]);
  const center = useMemo(() => computeCenter(clusters), [clusters]);

  return (
    <div className="relative h-full w-full rounded-md overflow-hidden border border-border/70">
      <MapContainer
        center={center}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        className="h-full w-full"
        minZoom={2}
        worldCopyJump
        preferCanvas
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          eventHandlers={{
            tileerror: () => setTileError(true),
          }}
        />

        {clusters.map((cluster) => {
          const radius = Math.min(18, 6 + Math.log2(cluster.items.length + 1) * 3);
          return (
            <CircleMarker
              key={cluster.key}
              center={[cluster.lat, cluster.lon]}
              radius={radius}
              pathOptions={{
                color: "#2D7BFF",
                weight: 1.2,
                fillColor: cluster.items.length > 1 ? "#00E676" : "#2D7BFF",
                fillOpacity: 0.72,
              }}
            >
              <Popup className="world-monitor-popup" maxWidth={440}>
                <div className="space-y-2 min-w-[230px]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-mono text-accent font-bold uppercase tracking-wider">
                      {cluster.label}
                    </p>
                    <span className="text-[10px] font-mono text-muted">
                      {cluster.items.length} event{cluster.items.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                    {cluster.items.slice(0, MAX_POPUP_ITEMS).map((item) => (
                      <article key={item.id} className="border border-border/60 rounded p-2 bg-background/70">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12px] leading-snug text-foreground hover:text-accent"
                        >
                          {item.title}
                        </a>
                        <div className="mt-1 text-[10px] text-muted font-mono">
                          <span>{item.source}</span>
                          <span> | </span>
                          <span>{formatDate(item.published_at)}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-muted font-mono">
                          <span>{item.category}</span>
                          <span> | </span>
                          <span>{item.country}</span>
                        </div>
                      </article>
                    ))}
                  </div>

                  {cluster.items.length > MAX_POPUP_ITEMS ? (
                    <p className="text-[10px] text-muted font-mono">
                      +{cluster.items.length - MAX_POPUP_ITEMS} more in this area
                    </p>
                  ) : null}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {clusters.length === 0 ? (
        <div className="absolute inset-0 z-[500] pointer-events-none flex items-center justify-center">
          <div className="rounded border border-border bg-panel/95 px-3 py-2 text-[11px] font-mono text-muted">
            No geo-tagged items for current filters.
          </div>
        </div>
      ) : null}

      {tileError ? (
        <div className="absolute left-3 top-3 z-[600] rounded border border-warning/40 bg-background/90 px-2 py-1 text-[10px] font-mono text-warning">
          Map tiles unavailable. Pins remain available.
        </div>
      ) : null}
    </div>
  );
}

function buildClusters(items: NewsItem[]): PinCluster[] {
  const map = new Map<string, PinCluster>();

  const sorted = [...items].sort(
    (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );

  for (const item of sorted) {
    if (item.lat === null || item.lon === null) {
      continue;
    }

    const clusterKey = item.country?.trim() || item.location_label?.trim() || `${item.lat}:${item.lon}`;
    const label = item.location_label || item.country || "Unknown";

    const existing = map.get(clusterKey);
    if (existing) {
      existing.items.push(item);
      continue;
    }

    map.set(clusterKey, {
      key: clusterKey,
      label,
      country: item.country,
      lat: item.lat,
      lon: item.lon,
      items: [item],
    });
  }

  return [...map.values()];
}

function computeCenter(clusters: PinCluster[]): [number, number] {
  if (clusters.length === 0) {
    return DEFAULT_CENTER;
  }

  const { latSum, lonSum } = clusters.reduce(
    (acc, cluster) => {
      acc.latSum += cluster.lat;
      acc.lonSum += cluster.lon;
      return acc;
    },
    { latSum: 0, lonSum: 0 }
  );

  return [latSum / clusters.length, lonSum / clusters.length];
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
