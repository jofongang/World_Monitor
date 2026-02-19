import MarketTrendsChart from "@/components/MarketTrendsChart";
import MarketsPanel from "@/components/MarketsPanel";

export default function MarketsPage() {
  return (
    <div className="space-y-4">
      <div className="glow-border rounded-lg bg-panel p-4">
        <h2 className="text-accent font-mono text-lg font-bold tracking-widest uppercase">
          Markets Overview
        </h2>
        <p className="text-muted text-xs font-mono mt-1">
          Live watchlist and multi-range market trend graph
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[380px,1fr] gap-4 items-start">
        <MarketsPanel />
        <MarketTrendsChart />
      </div>
    </div>
  );
}
