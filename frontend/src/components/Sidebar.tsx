"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/* ── Navigation items ──────────────────────────────────────────── */
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "◉" },
  { href: "/events", label: "Events", icon: "◈" },
  { href: "/markets", label: "Markets", icon: "◆" },
  { href: "/videos", label: "Videos", icon: "▶" },
] as const;

const REGIONS = [
  "All",
  "North America",
  "Europe",
  "Asia",
  "Middle East",
  "Africa",
  "Oceania",
  "Global",
] as const;

const CATEGORIES = [
  "All",
  "Economy",
  "Technology",
  "Politics",
  "Security",
  "Climate",
  "Energy",
  "Health",
] as const;

/* ── Component ─────────────────────────────────────────────────── */
export default function Sidebar() {
  const pathname = usePathname();
  const [region, setRegion] = useState("All");
  const [category, setCategory] = useState("All");

  return (
    <aside className="w-60 flex-shrink-0 bg-panel border-r border-border flex flex-col">
      {/* ── Logo / Title ─────────────────────────────────────── */}
      <div className="p-4 border-b border-border">
        <h1 className="text-accent font-mono text-lg font-bold tracking-wider">
          WORLD MONITOR
        </h1>
        <p className="text-muted text-[10px] font-mono mt-1 tracking-widest uppercase">
          v0.1.0 // Command Center
        </p>
      </div>

      {/* ── Navigation ───────────────────────────────────────── */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-mono transition-colors ${
                active
                  ? "bg-accent/10 text-accent border border-accent/30"
                  : "text-muted hover:text-foreground hover:bg-panel-hover border border-transparent"
              }`}
            >
              <span className="text-xs">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Filters (state only — no API filtering yet) ──────── */}
      <div className="p-3 border-t border-border space-y-3">
        {/* Region filter */}
        <div>
          <label className="text-[10px] text-muted font-mono uppercase tracking-widest block mb-1">
            Region
          </label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground font-mono focus:border-accent focus:outline-none appearance-none cursor-pointer"
          >
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Category filter */}
        <div>
          <label className="text-[10px] text-muted font-mono uppercase tracking-widest block mb-1">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground font-mono focus:border-accent focus:outline-none appearance-none cursor-pointer"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Status indicator ─────────────────────────────────── */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-positive animate-pulse" />
          <span className="text-[10px] text-muted font-mono uppercase tracking-wider">
            System Online
          </span>
        </div>
      </div>
    </aside>
  );
}
