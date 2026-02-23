"use client";

import { useEffect, useState } from "react";

import Panel from "@/components/ui/Panel";
import { fetchJobStatus, fetchSystemHealth, type JobStatusResponse } from "@/lib/api";

export default function HealthPage() {
  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);
  const [systemHealth, setSystemHealth] = useState<Awaited<
    ReturnType<typeof fetchSystemHealth>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setError(null);
        const [jobPayload, healthPayload] = await Promise.all([
          fetchJobStatus(),
          fetchSystemHealth(),
        ]);
        if (!active) return;
        setJobStatus(jobPayload);
        setSystemHealth(healthPayload);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Health check failed");
      }
    };
    void load();
    const interval = setInterval(() => void load(), 20000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="space-y-4">
      <Panel
        title="System Health"
        subtitle="Readiness, queues, ingestion jobs, and connector telemetry"
        contentClassName="px-4 pb-4"
      >
        {error ? <p className="text-sm font-mono text-danger">{error}</p> : null}
        {!error && !jobStatus ? (
          <p className="text-xs font-mono text-muted">Loading health telemetry...</p>
        ) : null}
      </Panel>

      {jobStatus ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Panel title="Job Queue" subtitle="Scheduler status" contentClassName="space-y-1 px-4 pb-4">
            <Metric label="Running" value={jobStatus.job.running ? "yes" : "no"} />
            <Metric label="Refresh Minutes" value={String(jobStatus.job.refresh_minutes)} />
            <Metric label="Last Run Start" value={formatDate(jobStatus.job.last_run_started_at)} />
            <Metric label="Last Run End" value={formatDate(jobStatus.job.last_run_finished_at)} />
            <Metric label="Next Run" value={formatDate(jobStatus.job.next_run_at)} />
            <Metric label="Last Error" value={jobStatus.job.last_error || "none"} />
          </Panel>

          <Panel title="Event Stats" subtitle="Database health counters" contentClassName="space-y-1 px-4 pb-4">
            <Metric label="Total Events" value={String(jobStatus.stats.total_events)} />
            <Metric label="Events 24h" value={String(jobStatus.stats.events_24h)} />
            <Metric label="Open Alerts" value={String(jobStatus.stats.open_alerts)} />
            <Metric label="Latest Event" value={formatDate(jobStatus.stats.latest_event_at)} />
          </Panel>

          <Panel title="Readiness" subtitle="System status lights source" contentClassName="space-y-1 px-4 pb-4">
            <Metric label="Status" value={systemHealth?.status || "unknown"} />
            <Metric label="Checked At" value={formatDate(systemHealth?.checked_at || null)} />
            <Metric label="Sources" value={String(systemHealth?.sources.length || 0)} />
            <Metric label="Ingest Count" value={String(systemHealth?.job.last_ingested_count || 0)} />
          </Panel>
        </div>
      ) : null}

      {systemHealth ? (
        <Panel title="Connector Health" subtitle="Live source state" contentClassName="px-4 pb-4">
          <div className="space-y-2">
            {systemHealth.sources.map((source) => (
              <div
                key={source.name}
                className="rounded border border-border bg-background/45 px-2 py-1 text-[11px] font-mono text-muted"
              >
                <span className="text-foreground">{source.name}</span> | items {source.items_fetched} |{" "}
                {source.last_error ? source.last_error : "ok"}
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-[11px] font-mono text-muted">
      <span className="text-foreground">{label}:</span> {value}
    </p>
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
    timeZoneName: "short",
  });
}
