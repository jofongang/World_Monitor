"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Chip from "@/components/ui/Chip";
import { useCommandState } from "@/components/ui/CommandState";

const TIME_WINDOWS = ["24h", "7d", "30d"] as const;

export default function HeaderBar() {
  const [clock, setClock] = useState("");
  const [timeWindow, setTimeWindow] = useState<(typeof TIME_WINDOWS)[number]>("24h");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const { searchQuery, setSearchQuery } = useCommandState();

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(
        now.toLocaleString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZoneName: "short",
        })
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
      return "No query";
    }
    return `Filtering: "${searchQuery.trim()}"`;
  }, [searchQuery]);

  return (
    <header className="relative z-[5] border-b border-border/85 bg-panel-alt/95 px-4 py-2">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            <span className="text-accent font-mono text-[11px] font-bold uppercase tracking-[0.16em]">
              Command Bar
            </span>
          </div>
          <span className="hidden sm:block text-border text-xs font-mono">|</span>
          <span className="truncate text-muted font-mono text-[10px] uppercase tracking-[0.12em]">
            {commandSummary}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 xl:max-w-[560px]">
          <div className="relative flex-1 min-w-0">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted text-[11px] font-mono">
              /
            </span>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search source, country, category, keyword..."
              className="w-full rounded-md border border-border bg-background/75 px-8 py-1.5 text-sm text-foreground font-mono placeholder:text-muted/55 outline-none transition-colors focus:border-accent"
            />
          </div>
          <div className="hidden lg:flex items-center gap-1">
            {TIME_WINDOWS.map((windowValue) => (
              <Chip
                key={windowValue}
                active={timeWindow === windowValue}
                onClick={() => setTimeWindow(windowValue)}
              >
                {windowValue}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <span className="text-[10px] font-mono text-muted uppercase tracking-wider">
            Live
          </span>
          <span className="text-[11px] font-mono text-foreground tabular-nums">
            {clock}
          </span>
        </div>
      </div>
    </header>
  );
}
