"use client";

import { useEffect, useMemo, useState } from "react";

import AlertsPanel from "@/components/AlertsPanel";
import MapPanel from "@/components/MapPanel";
import MarketsPanel from "@/components/MarketsPanel";
import NewsPanel from "@/components/NewsPanel";
import TerminalLogPanel from "@/components/TerminalLogPanel";
import Panel from "@/components/ui/Panel";
import {
  fetchAlerts,
  fetchHotspots,
  fetchNews,
  fetchPulse,
  fetchVideos,
  type AlertItem,
  type HotspotItem,
  type NewsItem,
  type PulseItem,
  type VideoItem,
} from "@/lib/api";

export default function GridPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [lastNewsUpdated, setLastNewsUpdated] = useState<string | null>(null);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [selectedNewsId, setSelectedNewsId] = useState<number | null>(null);

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  const [hotspots, setHotspots] = useState<HotspotItem[]>([]);
  const [pulse, setPulse] = useState<PulseItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [newsPayload, alertsPayload, hotspotsPayload, pulsePayload, videosPayload] =
          await Promise.all([
            fetchNews(),
            fetchAlerts(24),
            fetchHotspots(24, 8),
            fetchPulse({ windowHours: 6, baselineHours: 24 }),
            fetchVideos(),
          ]);
        if (!active) return;
        setNews(newsPayload.items);
        setLastNewsUpdated(newsPayload.last_updated);
        setAlerts(alertsPayload.items);
        setHotspots(hotspotsPayload.items);
        setPulse(pulsePayload.items);
        setVideos(videosPayload.slice(0, 8));
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Unexpected error";
        setNewsError(message);
        setAlertsError(message);
      } finally {
        if (!active) return;
        setNewsLoading(false);
        setAlertsLoading(false);
      }
    };

    void load();
    const interval = setInterval(() => void load(), 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const pinnedNews = useMemo(
    () => news.filter((item) => item.lat !== null && item.lon !== null),
    [news]
  );

  return (
    <div className="space-y-4">
      <Panel
        title="Monitor Wall"
        subtitle="Resizable multi-panel operational view"
        contentClassName="px-4 pb-4"
      >
        <p className="text-xs font-mono text-muted">
          Drag panel edges to resize. Data refreshes automatically every 30s.
        </p>
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7 resize overflow-auto">
          <MapPanel
            items={pinnedNews}
            loading={newsLoading}
            error={newsError}
            selectedNewsId={selectedNewsId}
            onSelectNews={setSelectedNewsId}
          />
        </div>

        <div className="xl:col-span-5 grid grid-cols-1 gap-4">
          <div className="resize overflow-auto">
            <AlertsPanel
              items={alerts}
              loading={alertsLoading}
              error={alertsError}
              onlyWatchlistMatches={false}
              onToggleOnlyMatches={() => undefined}
              onRefresh={() => undefined}
            />
          </div>

          <div className="resize overflow-auto">
            <NewsPanel
              items={news}
              lastUpdated={lastNewsUpdated}
              loading={newsLoading}
              refreshing={false}
              error={newsError}
              onRefresh={() => undefined}
              selectedNewsId={selectedNewsId}
              onSelectNews={setSelectedNewsId}
            />
          </div>
        </div>

        <div className="xl:col-span-4 resize overflow-auto">
          <MarketsPanel dense />
        </div>

        <div className="xl:col-span-4 resize overflow-auto">
          <HotspotsPulsePanel hotspots={hotspots} pulse={pulse} />
        </div>

        <div className="xl:col-span-4 resize overflow-auto">
          <VideoFeedPanel videos={videos} />
        </div>

        <div className="xl:col-span-12 resize overflow-auto">
          <TerminalLogPanel />
        </div>
      </div>
    </div>
  );
}

function HotspotsPulsePanel({
  hotspots,
  pulse,
}: {
  hotspots: HotspotItem[];
  pulse: PulseItem[];
}) {
  return (
    <Panel
      title="Hotspots + Pulse"
      subtitle="Top countries by volume and anomaly delta"
      contentClassName="px-4 pb-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[10px] font-mono uppercase tracking-wider text-muted">Hotspots</p>
          <div className="space-y-1">
            {hotspots.map((item) => (
              <div
                key={`${item.country}-${item.region}`}
                className="rounded border border-border bg-background/45 px-2 py-1 text-[11px] font-mono text-muted"
              >
                <span className="text-foreground">{item.country}</span> ({item.event_count})
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-mono uppercase tracking-wider text-muted">Pulse</p>
          <div className="space-y-1">
            {pulse.slice(0, 8).map((item) => (
              <div
                key={item.country}
                className="rounded border border-border bg-background/45 px-2 py-1 text-[11px] font-mono text-muted"
              >
                <span className="text-foreground">{item.country}</span> (x{item.delta_ratio.toFixed(2)})
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function VideoFeedPanel({ videos }: { videos: VideoItem[] }) {
  return (
    <Panel title="Video Feed" subtitle="Intelligence wall highlights" contentClassName="px-4 pb-4">
      <div className="space-y-2">
        {videos.length === 0 ? (
          <p className="text-xs font-mono text-muted">No video items.</p>
        ) : (
          videos.map((video) => (
            <a
              key={video.id}
              href={video.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded border border-border bg-background/45 p-2 hover:border-accent/35"
            >
              <p className="line-clamp-2 text-sm text-foreground">{video.title}</p>
              <p className="mt-1 text-[10px] font-mono text-muted">
                {video.source} | {formatAge(video.published_at)}
              </p>
            </a>
          ))
        )}
      </div>
    </Panel>
  );
}

function formatAge(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  const diff = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
  if (diff < 60) return `${diff}m ago`;
  if (diff < 60 * 24) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / (60 * 24))}d ago`;
}
