"use client";

import { useEffect, useState } from "react";

import Panel from "@/components/ui/Panel";
import { fetchSources, runJobs, type ConnectorStatusItem } from "@/lib/api";

export default function SourcesPage() {
  const [items, setItems] = useState<ConnectorStatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setError(null);
      const payload = await fetchSources();
      setItems(payload.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connectors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 20000);
    return () => clearInterval(interval);
  }, []);

  const onRun = async () => {
    setRunning(true);
    try {
      await runJobs();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run jobs");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Sources"
        subtitle="Connector status, last fetch, and error telemetry"
        rightSlot={
          <button
            type="button"
            onClick={() => void onRun()}
            disabled={running}
            className="rounded border border-accent/40 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-accent hover:bg-accent/10 disabled:opacity-60"
          >
            {running ? "Running..." : "Run Now"}
          </button>
        }
        contentClassName="px-4 pb-4"
      >
        {error ? (
          <p className="mb-2 rounded border border-warning/40 bg-warning/10 px-2 py-1 text-[11px] font-mono text-warning">
            {error}
          </p>
        ) : null}
        {loading ? (
          <p className="text-xs font-mono text-muted">Loading connector status...</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <article
                key={item.name}
                className="rounded border border-border bg-background/45 p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-mono text-foreground">{item.name}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${
                      item.last_error
                        ? "border border-danger/45 bg-danger/20 text-danger"
                        : "border border-positive/45 bg-positive/20 text-positive"
                    }`}
                  >
                    {item.last_error ? "Error" : "Healthy"}
                  </span>
                </div>
                <div className="mt-1 grid grid-cols-1 gap-1 text-[10px] font-mono text-muted sm:grid-cols-2">
                  <span>Enabled: {item.enabled ? "yes" : "no"}</span>
                  <span>Items: {item.items_fetched}</span>
                  <span>Duration: {item.last_duration_ms}ms</span>
                  <span>Next run: {formatDate(item.next_run_at)}</span>
                  <span>Last success: {formatDate(item.last_success_at)}</span>
                  <span>Last error: {formatDate(item.last_error_at)}</span>
                </div>
                {item.last_error ? (
                  <p className="mt-2 text-[10px] font-mono text-warning">{item.last_error}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
