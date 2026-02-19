import MapPanel from "@/components/MapPanel";
import NewsPanel from "@/components/NewsPanel";
import MarketsPanel from "@/components/MarketsPanel";

export default function DashboardPage() {
  return (
    <div className="space-y-4 h-full">
      {/* ── Top row: Map (2/3) + Markets (1/3) ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <MapPanel />
        </div>
        <div>
          <MarketsPanel />
        </div>
      </div>

      {/* ── Bottom row: Intel feed (full width) ──────────────── */}
      <NewsPanel />
    </div>
  );
}
