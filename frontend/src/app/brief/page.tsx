"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchBrief,
  type AlertItem,
  type BriefResponse,
  type BriefWindow,
} from "@/lib/api";

const WINDOW_OPTIONS: Array<{ value: BriefWindow; label: string }> = [
  { value: "24h", label: "Last 24h" },
  { value: "7d", label: "Last 7d" },
];

const SEVERITY_STYLES: Record<AlertItem["severity"], string> = {
  High: "bg-negative/20 text-negative border border-negative/40",
  Medium: "bg-warning/20 text-warning border border-warning/40",
  Low: "bg-accent/20 text-accent border border-accent/40",
};

export default function BriefPage() {
  const [windowValue, setWindowValue] = useState<BriefWindow>("24h");
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBrief = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const payload = await fetchBrief(windowValue);
      setBrief(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, [windowValue]);

  useEffect(() => {
    void loadBrief();
  }, [loadBrief]);

  const regionEntries = useMemo(() => {
    if (!brief) {
      return [] as Array<[string, BriefResponse["by_region"][string]]>;
    }
    return Object.entries(brief.by_region);
  }, [brief]);

  const downloadJson = () => {
    if (!brief) {
      return;
    }

    const blob = new Blob([JSON.stringify(brief, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `world-monitor-brief-${brief.window}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="glow-border rounded-lg bg-panel p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-accent font-mono text-lg font-bold tracking-widest uppercase">
              Daily Brief
            </h2>
            <p className="text-muted text-xs font-mono mt-1">
              Rule-based digest generated from cached news, alerts, and markets.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={windowValue}
              onChange={(event) => setWindowValue(event.target.value as BriefWindow)}
              className="bg-background border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
            >
              {WINDOW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void loadBrief()}
              className="px-3 py-1.5 rounded border border-accent/40 text-accent text-xs font-mono uppercase tracking-wider hover:bg-accent/10"
            >
              Refresh
            </button>

            <button
              type="button"
              onClick={downloadJson}
              disabled={!brief}
              className="px-3 py-1.5 rounded border border-border text-muted text-xs font-mono uppercase tracking-wider hover:border-accent/40 hover:text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Download JSON
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="glow-border rounded-lg bg-panel p-4">
          <p className="text-negative text-sm font-mono">Brief request failed: {error}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="glow-border rounded-lg bg-panel p-4">
          <p className="text-muted text-sm font-mono">Loading brief...</p>
        </div>
      ) : null}

      {!loading && brief ? (
        <>
          <section className="glow-border rounded-lg bg-panel p-4">
            <h3 className="text-accent font-mono text-xs font-bold uppercase tracking-widest">
              Summary
            </h3>
            <p className="text-muted text-[11px] font-mono mt-1">
              Generated: {formatTimestamp(brief.generated_at)}
            </p>
            <p className="mt-3 text-sm text-foreground leading-relaxed">{brief.one_paragraph_summary}</p>
          </section>

          <section className="glow-border rounded-lg bg-panel p-4">
            <h3 className="text-accent font-mono text-xs font-bold uppercase tracking-widest mb-3">
              Top Alerts
            </h3>
            <div className="space-y-2">
              {brief.top_alerts.length === 0 ? (
                <p className="text-muted text-xs font-mono">No alerts in selected window.</p>
              ) : (
                brief.top_alerts.map((alert) => (
                  <article key={alert.id} className="rounded border border-border bg-background/40 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <a
                        href={alert.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-foreground hover:text-accent transition-colors leading-snug"
                      >
                        {alert.title}
                      </a>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full whitespace-nowrap ${SEVERITY_STYLES[alert.severity]}`}
                      >
                        {alert.severity.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-muted font-mono">
                      {alert.country || "Global"} | {alert.topic} | {formatTimestamp(alert.published_at)}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="glow-border rounded-lg bg-panel p-4">
              <h3 className="text-accent font-mono text-xs font-bold uppercase tracking-widest mb-3">
                Developments by Region
              </h3>
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {regionEntries.length === 0 ? (
                  <p className="text-muted text-xs font-mono">No regional items in selected window.</p>
                ) : (
                  regionEntries.map(([region, items]) => (
                    <div key={region} className="rounded border border-border bg-background/30 p-2.5">
                      <h4 className="text-[11px] font-mono uppercase tracking-wider text-accent">{region}</h4>
                      <div className="mt-2 space-y-1.5">
                        {items.map((item, index) => (
                          <a
                            key={`${region}-${index}`}
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-[12px] text-foreground hover:text-accent transition-colors"
                          >
                            {item.title}
                            <span className="block text-[10px] text-muted font-mono mt-0.5">
                              {item.country} | {item.topic} | {formatTimestamp(item.published_at)}
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="glow-border rounded-lg bg-panel p-4">
              <h3 className="text-accent font-mono text-xs font-bold uppercase tracking-widest mb-3">
                Markets Snapshot
              </h3>
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {brief.markets_snapshot.length === 0 ? (
                  <p className="text-muted text-xs font-mono">Market snapshot unavailable.</p>
                ) : (
                  brief.markets_snapshot.map((market) => (
                    <div
                      key={market.symbol}
                      className="rounded border border-border bg-background/30 px-2.5 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-mono text-foreground">{market.symbol}</span>
                        <span className="text-[11px] font-mono text-muted">{formatPrice(market.price)}</span>
                      </div>
                      <div className="mt-1 text-[10px] font-mono text-muted">
                        {formatChange(market.change_pct)} | {market.provider} | {formatTimestamp(market.as_of)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
}

function formatPrice(value: number | null): string {
  if (value === null) {
    return "N/A";
  }

  if (Math.abs(value) >= 1000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }

  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function formatChange(value: number | null): string {
  if (value === null) {
    return "Change N/A";
  }
  return `Change ${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
