"use client";

type KpiProps = {
  label: string;
  value: string;
  delta?: number | null;
};

function formatDelta(delta: number): string {
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}%`;
}

export default function Kpi({ label, value, delta }: KpiProps) {
  const deltaClass =
    typeof delta !== "number"
      ? "text-muted"
      : delta >= 0
      ? "text-positive"
      : "text-danger";

  return (
    <div className="metric-card">
      <p className="metric-label">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <p className="metric-value">{value}</p>
        {typeof delta === "number" ? (
          <p className={`metric-delta ${deltaClass}`}>{formatDelta(delta)}</p>
        ) : (
          <p className="metric-delta text-muted">N/A</p>
        )}
      </div>
    </div>
  );
}
