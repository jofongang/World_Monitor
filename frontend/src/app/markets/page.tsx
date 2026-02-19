import MarketsPanel from "@/components/MarketsPanel";

export default function MarketsPage() {
  return (
    <div className="space-y-4">
      {/* ── Page header ──────────────────────────────────────── */}
      <div className="glow-border rounded-lg bg-panel p-4">
        <h2 className="text-accent font-mono text-lg font-bold tracking-widest uppercase">
          Markets Overview
        </h2>
        <p className="text-muted text-xs font-mono mt-1">
          Watchlist — Indices, commodities, crypto, FX
        </p>
      </div>

      {/* ── Markets panel ────────────────────────────────────── */}
      <div className="max-w-4xl">
        <MarketsPanel />
      </div>

      {/* ── Placeholder for charts + macro headlines ─────────── */}
      <div className="glow-border rounded-lg bg-panel p-8 text-center">
        <p className="text-muted text-sm font-mono">
          Charts and macro headlines will appear here in Step 2.
        </p>
        <span className="text-muted/50 text-[10px] font-mono tracking-widest uppercase mt-2 block">
          [ CHARTS PENDING // STEP 2 ]
        </span>
      </div>
    </div>
  );
}
