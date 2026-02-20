"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Chip from "@/components/ui/Chip";
import Panel from "@/components/ui/Panel";
import { fetchVideos, type VideoItem } from "@/lib/api";

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sourceFilter, setSourceFilter] = useState("all");
  const [topicFilter, setTopicFilter] = useState("all");
  const [focusId, setFocusId] = useState<string | null>(null);

  const loadVideos = useCallback(async (forceRefresh: boolean) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      setError(null);
      const payload = await fetchVideos({ refresh: forceRefresh });
      setVideos(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadVideos(false);
  }, [loadVideos]);

  const sourceOptions = useMemo(() => {
    const values = Array.from(new Set(videos.map((item) => item.source).filter(Boolean)));
    values.sort((a, b) => a.localeCompare(b));
    return values;
  }, [videos]);

  const topicOptions = useMemo(() => {
    const values = Array.from(new Set(videos.map((item) => item.topic).filter(Boolean)));
    values.sort((a, b) => a.localeCompare(b));
    return values;
  }, [videos]);

  const filteredVideos = useMemo(() => {
    return videos.filter((item) => {
      if (sourceFilter !== "all" && item.source !== sourceFilter) {
        return false;
      }
      if (topicFilter !== "all" && item.topic !== topicFilter) {
        return false;
      }
      return true;
    });
  }, [videos, sourceFilter, topicFilter]);

  useEffect(() => {
    if (filteredVideos.length === 0) {
      setFocusId(null);
      return;
    }
    const exists = filteredVideos.some((item) => item.id === focusId);
    if (!exists) {
      setFocusId(filteredVideos[0].id);
    }
  }, [filteredVideos, focusId]);

  const focusVideo = useMemo(
    () => filteredVideos.find((item) => item.id === focusId) ?? null,
    [filteredVideos, focusId]
  );
  const wallVideos = useMemo(() => filteredVideos.slice(0, 4), [filteredVideos]);

  const lastUpdated = useMemo(() => {
    const dates = filteredVideos
      .map((video) => new Date(video.published_at))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());

    if (dates.length === 0) {
      return "Unknown";
    }

    return dates[0].toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "short",
    });
  }, [filteredVideos]);

  return (
    <div className="space-y-4">
      <Panel
        title="Video Wall"
        subtitle={`Last updated ${lastUpdated}`}
        rightSlot={
          <button
            type="button"
            onClick={() => void loadVideos(true)}
            disabled={refreshing}
            className="rounded border border-accent/40 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-accent hover:bg-accent/10 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        }
        contentClassName="space-y-3 px-4 pb-4"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted">Source</span>
          <Chip active={sourceFilter === "all"} onClick={() => setSourceFilter("all")}>
            All
          </Chip>
          {sourceOptions.map((source) => (
            <Chip
              key={source}
              active={sourceFilter === source}
              onClick={() => setSourceFilter(source)}
            >
              {source}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted">Topic</span>
          <Chip active={topicFilter === "all"} onClick={() => setTopicFilter("all")}>
            All
          </Chip>
          {topicOptions.map((topic) => (
            <Chip
              key={topic}
              active={topicFilter === topic}
              onClick={() => setTopicFilter(topic)}
            >
              {topic}
            </Chip>
          ))}
        </div>
      </Panel>

      {error ? (
        <Panel title="Video Feed Warning" subtitle="Ingestion issue" contentClassName="px-4 pb-4">
          <p className="rounded border border-warning/35 bg-warning/10 p-2 text-[11px] font-mono text-warning">
            Video ingestion is unavailable right now. Error: {error}
          </p>
        </Panel>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="panel-frame p-3 animate-pulse">
              <div className="h-52 rounded bg-background/35" />
              <div className="mt-3 h-4 rounded bg-background/35" />
            </div>
          ))}
        </div>
      ) : filteredVideos.length === 0 ? (
        <Panel title="Video Wall" subtitle="No items" contentClassName="px-4 pb-4">
          <p className="text-muted text-sm font-mono">
            No videos match current filters.
          </p>
        </Panel>
      ) : (
        <>
          <Panel
            title="Focus View"
            subtitle="Primary briefing clip"
            contentClassName="px-4 pb-4"
          >
            {focusVideo ? <FocusVideo video={focusVideo} /> : null}
          </Panel>

          <Panel
            title="Wall Mode"
            subtitle="2x2 monitoring grid. Click any tile to focus."
            rightSlot={
              <span className="text-[10px] font-mono text-muted tracking-wider">
                {filteredVideos.length} items
              </span>
            }
            contentClassName="px-4 pb-4"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {wallVideos.map((video) => (
                <VideoWallTile
                  key={video.id}
                  video={video}
                  focused={focusId === video.id}
                  onFocus={() => setFocusId(video.id)}
                />
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function FocusVideo({ video }: { video: VideoItem }) {
  return (
    <article className="overflow-hidden rounded-md border border-border bg-background/45">
      <a href={video.url} target="_blank" rel="noreferrer" className="block">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="h-[320px] w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-[320px] w-full items-center justify-center bg-background/70 text-muted font-mono text-xs">
            No preview available
          </div>
        )}
      </a>

      <div className="space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-muted uppercase tracking-wider">
          <span className="text-accent-soft">{video.source}</span>
          <span>|</span>
          <span>{video.topic}</span>
          <span>|</span>
          <span>{formatRelativeTime(video.published_at)}</span>
        </div>

        <a
          href={video.url}
          target="_blank"
          rel="noreferrer"
          className="text-base font-medium leading-snug text-foreground hover:text-accent transition-colors"
        >
          {video.title}
        </a>

        <p className="text-sm text-muted leading-relaxed">
          {video.description || "Open source link for full briefing."}
        </p>
      </div>
    </article>
  );
}

function VideoWallTile({
  video,
  focused,
  onFocus,
}: {
  video: VideoItem;
  focused: boolean;
  onFocus: () => void;
}) {
  const containerRef = useRef<HTMLButtonElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
          }
        });
      },
      {
        rootMargin: "180px",
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <button
      ref={containerRef}
      type="button"
      onClick={onFocus}
      className={`overflow-hidden rounded-md border text-left transition-colors ${
        focused
          ? "border-accent/60 bg-accent/10"
          : "border-border bg-background/40 hover:border-accent/35"
      }`}
    >
      <div className="h-44 w-full bg-background/60">
        {visible && video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted font-mono text-[11px]">
            Loading preview...
          </div>
        )}
      </div>

      <div className="space-y-1 p-2.5">
        <p className="line-clamp-2 text-sm text-foreground leading-snug">{video.title}</p>
        <div className="text-[10px] font-mono text-muted">
          {video.source} | {formatRelativeTime(video.published_at)}
        </div>
      </div>
    </button>
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
