"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchReady, type ReadyResponse } from "@/lib/api";

type StatusLevel = "green" | "amber" | "red";

function resolveLevel(ready: ReadyResponse | null): StatusLevel {
  if (!ready) return "amber";
  if (ready.status === "ok" && ready.sources_healthy >= 2) return "green";
  if (ready.sources_healthy >= 1) return "amber";
  return "red";
}

const LIGHT_CLASS: Record<StatusLevel, string> = {
  green: "bg-positive shadow-[0_0_10px_rgba(0,230,118,0.8)]",
  amber: "bg-warning shadow-[0_0_10px_rgba(255,194,71,0.8)]",
  red: "bg-danger shadow-[0_0_10px_rgba(255,77,95,0.8)]",
};

export default function SystemStatusLights() {
  const [ready, setReady] = useState<ReadyResponse | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const payload = await fetchReady();
        if (active) {
          setReady(payload);
        }
      } catch {
        if (active) {
          setReady(null);
        }
      }
    };
    void load();
    const interval = setInterval(() => void load(), 20000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const level = useMemo(() => resolveLevel(ready), [ready]);

  return (
    <div className="inline-flex items-center gap-2 rounded border border-border bg-background/45 px-2 py-1">
      <span className={`h-2.5 w-2.5 rounded-full ${LIGHT_CLASS[level]} animate-pulse`} />
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
        {level === "green" ? "System Nominal" : level === "amber" ? "Degraded" : "Critical"}
      </span>
    </div>
  );
}
