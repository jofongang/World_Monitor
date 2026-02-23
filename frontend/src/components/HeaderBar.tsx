"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Chip from "@/components/ui/Chip";
import { useCommandState, type OpsWindow } from "@/components/ui/CommandState";
import SystemStatusLights from "@/components/SystemStatusLights";

const WINDOWS: OpsWindow[] = ["1h", "6h", "24h", "7d", "30d"];

export default function HeaderBar() {
  const [localClock, setLocalClock] = useState("");
  const [utcClock, setUtcClock] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const {
    searchQuery,
    setSearchQuery,
    opsWindow,
    setOpsWindow,
    watchlistOnly,
    setWatchlistOnly,
    setCommandPaletteOpen,
  } = useCommandState();

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setLocalClock(
        now.toLocaleString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZoneName: "short",
        })
      );
      setUtcClock(
        now.toLocaleString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: "UTC",
        }) + " UTC"
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (event.key === "/" && !isEditable) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const commandSummary = useMemo(() => {
    if (!searchQuery.trim()) {
      return "No active query";
    }
    return `Query: "${searchQuery.trim()}"`;
  }, [searchQuery]);

  return (
    <header className="relative z-[5] border-b border-border/90 bg-panel-alt/95 px-4 py-2.5">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-accent">
              Command Bar
            </span>
            <span className="hidden text-[10px] font-mono text-muted md:inline">{commandSummary}</span>
          </div>

          <div className="flex items-center gap-2">
            <SystemStatusLights />
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="rounded border border-border px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted hover:border-accent/40 hover:text-foreground"
            >
              Ctrl+K
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 xl:grid-cols-[1fr,auto,auto]">
          <div className="relative min-w-0">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-muted">
              /
            </span>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search events, countries, categories..."
              className="w-full rounded-md border border-border bg-background/75 px-8 py-1.5 text-sm text-foreground font-mono placeholder:text-muted/55 outline-none transition-colors focus:border-accent"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {WINDOWS.map((windowValue) => (
              <Chip
                key={windowValue}
                active={opsWindow === windowValue}
                onClick={() => setOpsWindow(windowValue)}
              >
                {windowValue}
              </Chip>
            ))}
            <Chip active={watchlistOnly} onClick={() => setWatchlistOnly((value) => !value)}>
              Watchlist
            </Chip>
          </div>

          <div className="flex items-center justify-end gap-2 text-[10px] font-mono text-muted">
            <span className="rounded border border-border bg-background/55 px-2 py-1 tabular-nums">
              {utcClock}
            </span>
            <span className="rounded border border-border bg-background/55 px-2 py-1 tabular-nums">
              {localClock}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
