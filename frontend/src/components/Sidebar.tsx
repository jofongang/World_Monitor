"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Ops View", icon: "01" },
  { href: "/grid", label: "Monitor Wall", icon: "02" },
  { href: "/alerts", label: "Alert Inbox", icon: "03" },
  { href: "/events", label: "Events", icon: "04" },
  { href: "/watchlists", label: "Watchlists", icon: "05" },
  { href: "/sources", label: "Sources", icon: "06" },
  { href: "/health", label: "Health", icon: "07" },
  { href: "/brief", label: "Daily Brief", icon: "08" },
  { href: "/markets", label: "Markets", icon: "09" },
  { href: "/prediction-markets", label: "Prediction Mkts", icon: "10" },
  { href: "/videos", label: "Video Wall", icon: "11" },
] as const;

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 flex-shrink-0 border-r border-border/90 bg-panel-alt/95 lg:flex lg:flex-col">
      <div className="border-b border-border/70 px-4 py-4">
        <h1 className="font-mono text-[17px] font-bold tracking-[0.16em] text-accent">
          WORLD MONITOR
        </h1>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          Situational Terminal v0.8.0
        </p>
      </div>

      <nav className="terminal-scroll flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-mono transition-colors ${
                active
                  ? "border-accent/45 bg-accent/15 text-accent"
                  : "border-transparent text-muted hover:border-border-strong hover:bg-panel-hover hover:text-foreground"
              }`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded border text-[10px] font-bold ${
                  active
                    ? "border-accent/60 text-accent"
                    : "border-border/70 text-muted group-hover:border-accent/35"
                }`}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/70 p-3">
        <div className="rounded-md border border-border/80 bg-background/50 p-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted">
            Session
          </p>
          <div className="mt-2 space-y-1 text-[10px] font-mono text-muted">
            <p>Mode: Monitor</p>
            <p>Feed: Public OSINT</p>
            <p className="flex items-center gap-2 text-positive">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-positive" />
              Live
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
