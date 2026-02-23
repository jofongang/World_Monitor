"use client";

import { useEffect, useMemo, useState } from "react";

import Panel from "@/components/ui/Panel";
import { fetchTimeline, type TimelineItem } from "@/lib/api";

type TimelineStripProps = {
  sinceHours: number;
};

export default function TimelineStrip({ sinceHours }: TimelineStripProps) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setError(null);
        const payload = await fetchTimeline({
          sinceHours,
          bucketMinutes: sinceHours <= 6 ? 15 : sinceHours <= 24 ? 30 : 60,
        });
        if (!active) return;
        setItems(payload.items);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Timeline failed");
      }
    };
    void load();
    const interval = setInterval(() => void load(), 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [sinceHours]);

  const maxCount = useMemo(() => {
    if (items.length === 0) return 1;
    return Math.max(...items.map((item) => item.event_count), 1);
  }, [items]);

  return (
    <Panel
      title="Timeline Strip"
      subtitle="Volume and average severity over time"
      className="min-h-[180px]"
      contentClassName="px-4 pb-4"
    >
      {error ? (
        <p className="mb-2 text-[10px] font-mono text-warning">Timeline warning: {error}</p>
      ) : null}
      <div className="flex h-[108px] items-end gap-1">
        {items.slice(-48).map((item) => {
          const height = Math.max(6, Math.round((item.event_count / maxCount) * 92));
          return (
            <div
              key={item.bucket_time}
              title={`${item.bucket_time} :: ${item.event_count} events`}
              className="group relative flex w-2 flex-1 items-end"
            >
              <div
                className="w-full rounded-sm bg-accent/70 transition-colors group-hover:bg-warning/80"
                style={{ height }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-muted">
        <span>{items.length} buckets</span>
        <span>Window {sinceHours}h</span>
      </div>
    </Panel>
  );
}
