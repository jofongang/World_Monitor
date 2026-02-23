"use client";

import { useEffect, useState } from "react";

import Panel from "@/components/ui/Panel";
import {
  fetchEvents,
  fetchEventDetail,
  type EventItem,
  type EventCategory,
} from "@/lib/api";

const CATEGORY_FILTERS: Array<EventCategory | "all"> = [
  "all",
  "conflict",
  "diplomacy",
  "sanctions",
  "cyber",
  "disaster",
  "markets",
  "other",
];

export default function EventsPage() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [related, setRelated] = useState<EventItem[]>([]);
  const [category, setCategory] = useState<EventCategory | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (refresh = false) => {
    setLoading(true);
    try {
      setError(null);
      const payload = await fetchEvents({
        limit: 200,
        sinceHours: 24 * 7,
        category: category === "all" ? undefined : category,
        refresh,
      });
      setItems(payload.items);
      if (payload.items.length > 0) {
        await loadDetail(payload.items[0].id);
      } else {
        setSelected(null);
        setRelated([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (eventId: string) => {
    try {
      const payload = await fetchEventDetail(eventId);
      setSelected(payload.event);
      setRelated(payload.related);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load event detail");
    }
  };

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  return (
    <div className="space-y-4">
      <Panel
        title="Unified Events"
        subtitle="Normalized OSINT event pipeline"
        rightSlot={
          <button
            type="button"
            onClick={() => void load(true)}
            className="rounded border border-accent/40 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-accent hover:bg-accent/10"
          >
            Refresh
          </button>
        }
        contentClassName="space-y-2 px-4 pb-4"
      >
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider ${
                category === value
                  ? "border-accent/45 bg-accent/15 text-accent"
                  : "border-border text-muted hover:border-accent/35 hover:text-foreground"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </Panel>

      {error ? (
        <Panel title="Error" subtitle="Event service warning" contentClassName="px-4 pb-4">
          <p className="text-sm font-mono text-danger">{error}</p>
        </Panel>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr,0.85fr]">
        <Panel title="Feed" subtitle={`${items.length} events`} contentClassName="px-4 pb-4">
          {loading ? (
            <p className="text-xs font-mono text-muted">Loading events...</p>
          ) : (
            <div className="terminal-scroll max-h-[640px] space-y-2 overflow-y-auto pr-1">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void loadDetail(item.id)}
                  className={`w-full rounded border p-2 text-left ${
                    selected?.id === item.id
                      ? "border-accent/50 bg-accent/12"
                      : "border-border bg-background/45 hover:border-accent/35"
                  }`}
                >
                  <p className="text-sm leading-snug text-foreground">{item.title}</p>
                  <p className="mt-1 text-[10px] font-mono text-muted">
                    {item.source} | {item.country} | {item.category} | sev {item.severity}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Intel Card" subtitle="Selected event + cluster context" contentClassName="px-4 pb-4">
          {!selected ? (
            <p className="text-xs font-mono text-muted">Select an event to inspect details.</p>
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm leading-snug text-foreground">{selected.title}</h3>
              <p className="text-xs text-muted">{selected.summary || selected.body_snippet}</p>
              <div className="text-[10px] font-mono text-muted">
                {selected.source} | {selected.country} | {selected.region}
              </div>
              <div className="text-[10px] font-mono text-muted">
                severity {selected.severity} | confidence {selected.confidence}
              </div>
              <a
                href={selected.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded border border-accent/40 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-accent hover:bg-accent/10"
              >
                Open Source
              </a>

              <div className="border-t border-border pt-2">
                <p className="mb-1 text-[10px] font-mono uppercase tracking-wider text-muted">
                  Related Cluster
                </p>
                <div className="space-y-1">
                  {related.map((item) => (
                    <div
                      key={item.id}
                      className="rounded border border-border bg-background/45 px-2 py-1 text-[11px] text-muted"
                    >
                      {item.title}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
