"use client";

import { useEffect, useState } from "react";

import Panel from "@/components/ui/Panel";
import { fetchJobLogs, type IngestionLogItem } from "@/lib/api";

type TerminalLogPanelProps = {
  dense?: boolean;
};

export default function TerminalLogPanel({ dense = false }: TerminalLogPanelProps) {
  const [items, setItems] = useState<IngestionLogItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setError(null);
        const payload = await fetchJobLogs(dense ? 50 : 120);
        if (!active) return;
        setItems(payload.items);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load logs");
      }
    };

    void load();
    const interval = setInterval(() => void load(), 12000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [dense]);

  return (
    <Panel
      title="Terminal Log"
      subtitle="Ingestion status stream"
      className={dense ? "min-h-[260px]" : "min-h-[320px]"}
      contentClassName="px-4 pb-4"
    >
      {error ? (
        <p className="mb-2 rounded border border-warning/40 bg-warning/10 px-2 py-1 text-[10px] font-mono text-warning">
          Log stream warning: {error}
        </p>
      ) : null}
      <div className={`terminal-scroll overflow-y-auto ${dense ? "max-h-[220px]" : "max-h-[280px]"} space-y-1`}>
        {items.length === 0 ? (
          <p className="text-xs font-mono text-muted">No log entries yet.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[66px,96px,1fr] gap-2 rounded border border-border bg-background/45 px-2 py-1 text-[10px] font-mono"
            >
              <span className="text-muted">{formatTime(item.created_at)}</span>
              <span className="truncate text-accent-soft">{item.connector}</span>
              <span className={item.level === "ERROR" ? "text-danger" : "text-muted"}>
                {item.level}: {item.message}
              </span>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
