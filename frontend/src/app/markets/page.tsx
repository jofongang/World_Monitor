import MarketTrendsChart from "@/components/MarketTrendsChart";
import MarketsPanel from "@/components/MarketsPanel";
import Panel from "@/components/ui/Panel";

export default function MarketsPage() {
  return (
    <div className="space-y-4">
      <Panel
        title="Markets Overview"
        subtitle="Live watchlist plus multi-range trend graph."
        contentClassName="px-4 pb-4"
      >
        <p className="text-xs text-muted font-mono">
          Green signals positive momentum, red signals downside pressure.
        </p>
      </Panel>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[380px,1fr]">
        <MarketsPanel />
        <MarketTrendsChart />
      </div>
    </div>
  );
}
