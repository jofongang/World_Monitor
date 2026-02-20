"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "[D]" },
  { href: "/watchlists", label: "Watchlists", icon: "[W]" },
  { href: "/brief", label: "Daily Brief", icon: "[B]" },
  { href: "/events", label: "Events", icon: "[E]" },
  { href: "/markets", label: "Markets", icon: "[M]" },
  { href: "/videos", label: "Videos", icon: "[V]" },
] as const;

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 flex-shrink-0 bg-panel border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <h1 className="text-accent font-mono text-lg font-bold tracking-wider">
          WORLD MONITOR
        </h1>
        <p className="text-muted text-[10px] font-mono mt-1 tracking-widest uppercase">
          v0.5.0 // Command Center
        </p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
              <span className="text-[11px]">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="text-[10px] text-muted font-mono uppercase tracking-wider mb-2">
          Monitor Mode
        </div>
        <div className="space-y-1 text-[10px] font-mono text-muted/80">
          <div>1. Watchlists define priorities</div>
          <div>2. Alerts flag new matches</div>
          <div>3. Daily brief summarizes risk</div>
        </div>
      </div>

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
