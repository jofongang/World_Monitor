"use client";

import { useState, useEffect } from "react";

export default function HeaderBar() {
  const [time, setTime] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(
        now.toISOString().slice(11, 19) + " UTC"
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-12 flex-shrink-0 bg-panel border-b border-border flex items-center justify-between px-4">
      {/* ── Left: context label ──────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="text-accent font-mono text-xs tracking-widest uppercase font-bold">
          Command Center
        </span>
        <span className="text-border font-mono text-xs">|</span>
        <span className="text-muted font-mono text-[10px] tracking-wider uppercase">
          Global Intel
        </span>
      </div>

      {/* ── Center: search ───────────────────────────────────── */}
      <div className="flex-1 max-w-md mx-4">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs">
            ⌘
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events, markets, regions..."
            className="w-full bg-background border border-border rounded px-8 py-1.5 text-sm text-foreground font-mono placeholder:text-muted/40 focus:border-accent focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* ── Right: clock ─────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        <span className="text-muted font-mono text-xs tabular-nums tracking-wider">
          {time}
        </span>
      </div>
    </header>
  );
}
