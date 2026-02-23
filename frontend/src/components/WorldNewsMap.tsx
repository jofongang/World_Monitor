"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";

import type { NewsItem } from "@/lib/api";

type WorldNewsMapProps = {
  items: NewsItem[];
  selectedNewsId: number | null;
  onSelectNews: (id: number | null) => void;
};

type PinCluster = {
  key: string;
  label: string;
  country: string;
  lat: number;
  lon: number;
  items: NewsItem[];
};

type MarkerRecord = {
  marker: GoogleMarker;
  cluster: PinCluster;
};

const DEFAULT_CENTER: [number, number] = [18, 8];
const DEFAULT_ZOOM = 2.2;
const FOCUS_ZOOM = 4.0;
const MAX_POPUP_ITEMS = 6;
const GOOGLE_MAPS_SCRIPT_ID = "world-monitor-google-maps";

let googleMapsPromise: Promise<GoogleMapsAny> | null = null;

export default function WorldNewsMap({
  items,
  selectedNewsId,
  onSelectNews,
}: WorldNewsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const infoWindowRef = useRef<GoogleInfoWindow | null>(null);
  const markersRef = useRef<MarkerRecord[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID?.trim() ?? "";

  const clusters = useMemo(() => buildClusters(items), [items]);
  const center = useMemo(() => computeCenter(clusters), [clusters]);

  useEffect(() => {
    let cancelled = false;

    async function initializeMap() {
      if (!apiKey || !mapContainerRef.current) {
        return;
      }

      try {
        const googleApi = await loadGoogleMaps(apiKey);
        if (cancelled || !mapContainerRef.current) {
          return;
        }

        const options: Record<string, unknown> = {
          center: { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] },
          zoom: DEFAULT_ZOOM,
          minZoom: 2,
          maxZoom: 8,
          mapTypeId: "hybrid",
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          rotateControl: true,
          zoomControl: true,
          gestureHandling: "greedy",
          backgroundColor: "#060911",
        };

        if (mapId) {
          options.mapId = mapId;
        }

        const map = new googleApi.maps.Map(mapContainerRef.current, options);
        mapRef.current = map;
        infoWindowRef.current = new googleApi.maps.InfoWindow();
        setMapError(null);

        applyCamera(map, DEFAULT_CENTER, DEFAULT_ZOOM);
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Unable to initialize Google map.";
        setMapError(message);
      }
    }

    void initializeMap();

    return () => {
      cancelled = true;
      clearMarkers(markersRef);
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }
      mapRef.current = null;
    };
  }, [apiKey, mapId]);

  useEffect(() => {
    const map = mapRef.current;
    const googleApi = window.google;
    if (!map || !googleApi?.maps) {
      return;
    }

    clearMarkers(markersRef);

    for (const cluster of clusters) {
      const selected = cluster.items.some((item) => item.id === selectedNewsId);
      const marker = new googleApi.maps.Marker({
        map,
        position: { lat: cluster.lat, lng: cluster.lon },
        title: cluster.label,
        zIndex: selected ? 1000 : 100,
        icon: {
          path: googleApi.maps.SymbolPath.CIRCLE,
          scale: selected
            ? 11
            : Math.min(9, 4.5 + Math.log2(cluster.items.length + 1) * 1.6),
          fillColor: selected
            ? "#FFC247"
            : cluster.items.length > 1
              ? "#00E676"
              : "#2D7BFF",
          fillOpacity: selected ? 0.95 : 0.8,
          strokeColor: selected ? "#FFC247" : "#2D7BFF",
          strokeWeight: selected ? 2.6 : 1.2,
        },
        label:
          cluster.items.length > 1
            ? {
                text: String(cluster.items.length),
                color: "#060911",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "10px",
                fontWeight: "700",
              }
            : undefined,
      });

      marker.addListener("click", () => {
        const selectedItem = cluster.items[0] ?? null;
        onSelectNews(selectedItem?.id ?? null);
        applyCamera(map, [cluster.lat, cluster.lon], Math.max(map.getZoom() ?? 0, FOCUS_ZOOM));

        const infoWindow = infoWindowRef.current;
        if (infoWindow) {
          infoWindow.setContent(buildPopupHtml(cluster, selectedNewsId));
          infoWindow.open({ map, anchor: marker });
        }
      });

      markersRef.current.push({ marker, cluster });
    }
  }, [clusters, onSelectNews, selectedNewsId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (selectedNewsId === null) {
      applyCamera(map, center, DEFAULT_ZOOM);
      return;
    }

    const selectedCluster = clusters.find((cluster) =>
      cluster.items.some((item) => item.id === selectedNewsId)
    );
    if (!selectedCluster) {
      return;
    }

    applyCamera(
      map,
      [selectedCluster.lat, selectedCluster.lon],
      Math.max(map.getZoom() ?? 0, FOCUS_ZOOM)
    );
  }, [center, clusters, selectedNewsId]);

  if (!apiKey) {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-md border border-border/70 bg-background/85">
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="max-w-lg rounded border border-warning/45 bg-panel/95 p-3 text-center">
            <p className="text-[11px] font-mono uppercase tracking-wider text-warning">
              Google 3D map not configured
            </p>
            <p className="mt-2 text-xs text-muted">
              Set <code className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in{" "}
              <code className="font-mono">frontend/.env.local</code> to enable Google Earth-style
              3D globe view.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md border border-border/70">
      <div ref={mapContainerRef} className="h-full w-full" />

      <div className="pointer-events-none absolute right-3 top-3 z-10 rounded border border-accent/40 bg-background/80 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.12em] text-accent">
        3D Globe
      </div>

      {clusters.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded border border-border bg-panel/95 px-3 py-2 text-[11px] font-mono text-muted">
            No geo-tagged items for current filters.
          </div>
        </div>
      ) : null}

      {mapError ? (
        <div className="absolute left-3 top-3 z-10 rounded border border-warning/40 bg-background/90 px-2 py-1 text-[10px] font-mono text-warning">
          {mapError}
        </div>
      ) : null}
    </div>
  );
}

function clearMarkers(markersRef: MutableRefObject<MarkerRecord[]>) {
  const eventApi = window.google?.maps?.event;
  for (const record of markersRef.current) {
    if (eventApi) {
      eventApi.clearInstanceListeners(record.marker);
    }
    record.marker.setMap(null);
  }
  markersRef.current = [];
}

function applyCamera(map: GoogleMapInstance, center: [number, number], zoom: number) {
  if (typeof map.moveCamera === "function") {
    map.moveCamera({
      center: { lat: center[0], lng: center[1] },
      zoom,
      heading: 0,
      tilt: 60,
    });
    return;
  }

  map.setCenter({ lat: center[0], lng: center[1] });
  map.setZoom(zoom);
}

function buildPopupHtml(cluster: PinCluster, selectedNewsId: number | null): string {
  const rows = cluster.items
    .slice(0, MAX_POPUP_ITEMS)
    .map((item) => {
      const selectedClass = item.id === selectedNewsId ? " wm-google-popup-item-selected" : "";
      return `<article class="wm-google-popup-item${selectedClass}">
          <div class="wm-google-popup-title">${escapeHtml(item.title)}</div>
          <div class="wm-google-popup-meta">${escapeHtml(item.source)} | ${escapeHtml(formatDate(item.published_at))}</div>
          <div class="wm-google-popup-meta">${escapeHtml(item.category)} | ${escapeHtml(item.country || "Global")}</div>
        </article>`;
    })
    .join("");

  const remaining = cluster.items.length - MAX_POPUP_ITEMS;
  const footer =
    remaining > 0
      ? `<div class="wm-google-popup-footer">+${remaining} more in this area</div>`
      : "";

  return `<div class="wm-google-popup">
      <div class="wm-google-popup-header">
        <span>${escapeHtml(cluster.label)}</span>
        <span>${cluster.items.length} event${cluster.items.length > 1 ? "s" : ""}</span>
      </div>
      <div class="wm-google-popup-list">${rows}</div>
      ${footer}
    </div>`;
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

    const clusterKey =
      item.country?.trim() || item.location_label?.trim() || `${item.lat}:${item.lon}`;
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function loadGoogleMaps(apiKey: string): Promise<GoogleMapsAny> {
  if (window.google?.maps) {
    return window.google;
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise<GoogleMapsAny>((resolve, reject) => {
    const existingScript = document.getElementById(
      GOOGLE_MAPS_SCRIPT_ID
    ) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (window.google?.maps) {
          resolve(window.google);
        } else {
          reject(new Error("Google Maps API loaded but unavailable."));
        }
      });
      existingScript.addEventListener("error", () =>
        reject(new Error("Failed to load Google Maps API script."))
      );
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google);
        return;
      }
      reject(new Error("Google Maps API loaded but unavailable."));
    };
    script.onerror = () => {
      reject(new Error("Failed to load Google Maps API script."));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    googleMapsPromise = null;
    throw error;
  });

  return googleMapsPromise;
}

type LatLngLiteral = {
  lat: number;
  lng: number;
};

type GoogleMarker = {
  addListener: (eventName: "click", handler: () => void) => void;
  setMap: (map: GoogleMapInstance | null) => void;
};

type GoogleInfoWindow = {
  setContent: (content: string) => void;
  open: (options: { map: GoogleMapInstance; anchor?: GoogleMarker }) => void;
  close: () => void;
};

type GoogleMapInstance = {
  moveCamera?: (options: {
    center: LatLngLiteral;
    zoom: number;
    heading: number;
    tilt: number;
  }) => void;
  setCenter: (center: LatLngLiteral) => void;
  setZoom: (zoom: number) => void;
  getZoom: () => number | undefined;
};

type GoogleMapsAny = {
  maps: {
    Map: new (container: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
    InfoWindow: new () => GoogleInfoWindow;
    Marker: new (options: Record<string, unknown>) => GoogleMarker;
    SymbolPath: {
      CIRCLE: unknown;
    };
    event: {
      clearInstanceListeners: (instance: unknown) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleMapsAny;
  }
}
