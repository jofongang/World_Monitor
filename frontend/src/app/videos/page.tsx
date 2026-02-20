"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchVideos, type VideoItem } from "@/lib/api";

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sourceFilter, setSourceFilter] = useState("all");
  const [topicFilter, setTopicFilter] = useState("all");

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

  return (
    <div className="space-y-4">
      <div className="glow-border rounded-lg bg-panel p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-accent font-mono text-lg font-bold tracking-widest uppercase">
              World Briefing Channel
            </h2>
            <p className="text-muted text-xs font-mono mt-1">
              English-first geopolitics, economy, and markets videos from free sources.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              className="bg-background border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
            >
              <option value="all">All sources</option>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>

            <select
              value={topicFilter}
              onChange={(event) => setTopicFilter(event.target.value)}
              className="bg-background border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
            >
              <option value="all">All topics</option>
              {topicOptions.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void loadVideos(true)}
              disabled={refreshing}
              className="px-3 py-1.5 rounded border border-accent/40 text-accent text-xs font-mono uppercase tracking-wider hover:bg-accent/10 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-muted font-mono">
          {filteredVideos.length} items shown
        </div>
      </div>

      {error ? (
        <div className="glow-border rounded-lg bg-panel p-4">
          <p className="text-warning text-xs font-mono">
            Video ingestion is unavailable right now. Serving cached feed when possible. Error: {error}
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="glow-border rounded-lg bg-panel p-3 animate-pulse">
              <div className="h-40 bg-background/40 rounded" />
              <div className="h-4 bg-background/40 rounded mt-3" />
              <div className="h-3 bg-background/40 rounded mt-2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredVideos.length === 0 ? (
            <div className="glow-border rounded-lg bg-panel p-4 md:col-span-2 xl:col-span-3">
              <p className="text-muted text-sm font-mono">No videos match the current filters.</p>
            </div>
          ) : (
            filteredVideos.map((video) => (
              <article key={video.id} className="glow-border rounded-lg bg-panel overflow-hidden">
                <a href={video.url} target="_blank" rel="noreferrer" className="block">
                  {video.thumbnail ? (
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-44 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-44 bg-background/60 flex items-center justify-center text-muted font-mono text-xs">
                      NO PREVIEW
                    </div>
                  )}
                </a>

                <div className="p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-accent">
                      {video.source}
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted">
                      {video.topic}
                    </span>
                  </div>

                  <a
                    href={video.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-foreground hover:text-accent transition-colors leading-snug font-medium"
                  >
                    {video.title}
                  </a>

                  <p className="mt-2 text-xs text-muted line-clamp-3">
                    {video.description || "Open the briefing link to watch the full video."}
                  </p>

                  <div className="mt-3 flex items-center justify-between text-[10px] text-muted font-mono">
                    <span>{formatRelativeTime(video.published_at)}</span>
                    <span>{video.provider}</span>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
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
