"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchMarketHistory,
  type MarketHistoryRange,
  type MarketHistoryResponse,
} from "@/lib/api";
import { COLORS } from "@/styles/theme";

const RANGE_OPTIONS: Array<{ value: MarketHistoryRange; label: string }> = [
  { value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
  { value: "1m", label: "1M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
];

const SERIES_COLORS: Record<string, string> = {
  SPY: "#2D7BFF",
  DIA: "#00E676",
  QQQ: "#FFB300",
  EWU: "#AB47BC",
  EWJ: "#26C6DA",
  GLD: "#FFD54F",
  USO: "#EF5350",
  BTC: "#FF6D00",
  SPX: "#2D7BFF",
  DJI: "#00E676",
  IXIC: "#FFB300",
  FTSE: "#AB47BC",
  N225: "#26C6DA",
  GC: "#FFD54F",
  CL: "#EF5350",
};

const FALLBACK_COLORS = [
  "#2D7BFF",
  "#00E676",
  "#FFB300",
  "#AB47BC",
  "#26C6DA",
  "#FF6D00",
  "#FFD54F",
  "#EF5350",
  "#7E57C2",
  "#4DD0E1",
];

const SVG_WIDTH = 840;
const SVG_HEIGHT = 360;
const CHART_LEFT = 56;
const CHART_RIGHT = 20;
const CHART_TOP = 18;
const CHART_BOTTOM = 36;

type ChartSeries = {
  symbol: string;
  name: string;
  color: string;
  path: string;
  lastChange: number | null;
};

type ChartModel = {
  series: ChartSeries[];
  yTicks: Array<{ value: number; y: number }>;
  xLabels: Array<{ label: string; x: number }>;
};

export default function MarketTrendsChart() {
  const [range, setRange] = useState<MarketHistoryRange>("1m");
  const [history, setHistory] = useState<MarketHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchMarketHistory(range);
        if (active) {
          setHistory(result);
        }
      } catch (err) {
        if (active) {
          const message = err instanceof Error ? err.message : "Unknown error";
          setError(message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [range]);

  const model = useMemo(() => {
    if (!history) {
      return null;
    }
    return buildChartModel(history, range);
  }, [history, range]);

  return (
    <section className="glow-border rounded-lg bg-panel p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-accent font-mono text-sm font-bold tracking-widest uppercase">
            Market Trends
          </h2>
          <p className="text-muted text-[11px] font-mono mt-1">
            Multi-asset performance over selected time window
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-muted/80 text-[10px] font-mono tracking-wider uppercase">
            Y-Axis Window
          </p>
          <div className="flex flex-wrap gap-1">
            {RANGE_OPTIONS.map((option) => {
              const isActive = option.value === range;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRange(option.value)}
                  className={`rounded-md border px-2.5 py-1 text-[10px] font-mono font-bold tracking-widest transition-colors ${
                    isActive
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border text-muted hover:text-foreground hover:border-accent/40"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loading && <ChartSkeleton />}

      {!loading && error && (
        <div className="mt-4 bg-negative/5 border border-negative/30 rounded-md p-3">
          <p className="text-negative text-xs font-mono font-bold">
            CHART DATA ERROR
          </p>
          <p className="text-muted text-[11px] font-mono mt-1">{error}</p>
        </div>
      )}

      {!loading && !error && model && (
        <>
          <div className="mt-4 rounded-md border border-border/60 bg-background/30 p-2">
            <div className="overflow-x-auto">
              <svg
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                className="w-full min-w-[560px] h-[300px]"
                role="img"
                aria-label="Market history trend chart"
              >
                <rect
                  x={CHART_LEFT}
                  y={CHART_TOP}
                  width={SVG_WIDTH - CHART_LEFT - CHART_RIGHT}
                  height={SVG_HEIGHT - CHART_TOP - CHART_BOTTOM}
                  fill="rgba(11, 16, 32, 0.75)"
                  stroke="rgba(26, 39, 68, 0.7)"
                  strokeWidth="1"
                />

                {model.yTicks.map((tick, index) => (
                  <g key={`${tick.value}-${index}`}>
                    <line
                      x1={CHART_LEFT}
                      y1={tick.y}
                      x2={SVG_WIDTH - CHART_RIGHT}
                      y2={tick.y}
                      stroke="rgba(45, 123, 255, 0.12)"
                      strokeWidth={tick.value === 0 ? 1.2 : 1}
                    />
                    <text
                      x={CHART_LEFT - 8}
                      y={tick.y + 4}
                      textAnchor="end"
                      fill={COLORS.textMuted}
                      fontSize="10"
                      fontFamily="var(--font-geist-mono)"
                    >
                      {formatPercent(tick.value)}
                    </text>
                  </g>
                ))}

                {model.xLabels.map((label) => (
                  <g key={`${label.x}-${label.label}`}>
                    <line
                      x1={label.x}
                      y1={CHART_TOP}
                      x2={label.x}
                      y2={SVG_HEIGHT - CHART_BOTTOM}
                      stroke="rgba(45, 123, 255, 0.08)"
                      strokeWidth="1"
                    />
                    <text
                      x={label.x}
                      y={SVG_HEIGHT - 10}
                      textAnchor="middle"
                      fill={COLORS.textMuted}
                      fontSize="10"
                      fontFamily="var(--font-geist-mono)"
                    >
                      {label.label}
                    </text>
                  </g>
                ))}

                {model.series.map((series) => (
                  <path
                    key={series.symbol}
                    d={series.path}
                    fill="none"
                    stroke={series.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {model.series.map((series) => {
              const value = series.lastChange;
              const positive = value !== null && value >= 0;
              return (
                <div
                  key={series.symbol}
                  className="rounded-md border border-border/70 bg-background/30 px-2 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: series.color }}
                    />
                    <span className="text-[11px] font-mono text-foreground font-bold">
                      {series.symbol}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted truncate mt-1">{series.name}</p>
                  <p
                    className={`text-[11px] font-mono mt-1 tabular-nums ${
                      positive ? "text-positive" : "text-negative"
                    }`}
                  >
                    {value === null
                      ? "N/A"
                      : `${positive ? "+" : ""}${value.toFixed(2)}%`}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function ChartSkeleton() {
  return (
    <div className="mt-4 rounded-md border border-border/60 bg-background/30 p-3">
      <div className="h-[280px] animate-pulse rounded bg-panel-hover/40" />
    </div>
  );
}

function buildChartModel(
  history: MarketHistoryResponse,
  range: MarketHistoryRange
): ChartModel | null {
  const timestamps = Array.from(
    new Set(
      history.series.flatMap((series) =>
        series.points.map((point) => point.timestamp)
      )
    )
  ).sort();

  if (timestamps.length === 0) {
    return null;
  }

  const plotWidth = SVG_WIDTH - CHART_LEFT - CHART_RIGHT;
  const plotHeight = SVG_HEIGHT - CHART_TOP - CHART_BOTTOM;

  const rawSeries: Array<{
    symbol: string;
    name: string;
    color: string;
    values: Array<number | null>;
  }> = [];

  let globalMin = Number.POSITIVE_INFINITY;
  let globalMax = Number.NEGATIVE_INFINITY;

  history.series.forEach((series, index) => {
    const pointMap = new Map(series.points.map((point) => [point.timestamp, point.price]));

    let carry: number | null = null;
    const filledValues: Array<number | null> = timestamps.map((timestamp) => {
      const value = pointMap.get(timestamp);
      if (typeof value === "number") {
        carry = value;
      }
      return carry;
    });

    const startValue = filledValues.find(
      (value): value is number => typeof value === "number" && value > 0
    );

    const normalized = filledValues.map((value) => {
      if (value === null || startValue === undefined || startValue <= 0) {
        return null;
      }
      return ((value - startValue) / startValue) * 100;
    });

    normalized.forEach((value) => {
      if (value === null) {
        return;
      }
      if (value < globalMin) {
        globalMin = value;
      }
      if (value > globalMax) {
        globalMax = value;
      }
    });

    rawSeries.push({
      symbol: series.symbol,
      name: series.name,
      color: SERIES_COLORS[series.symbol] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
      values: normalized,
    });
  });

  if (!Number.isFinite(globalMin) || !Number.isFinite(globalMax)) {
    globalMin = -1;
    globalMax = 1;
  }

  if (Math.abs(globalMax - globalMin) < 0.1) {
    globalMax += 0.05;
    globalMin -= 0.05;
  }

  const padding = (globalMax - globalMin) * 0.12;
  const minY = globalMin - padding;
  const maxY = globalMax + padding;

  const xForIndex = (index: number): number => {
    if (timestamps.length === 1) {
      return CHART_LEFT + plotWidth / 2;
    }
    return CHART_LEFT + (index / (timestamps.length - 1)) * plotWidth;
  };

  const yForValue = (value: number): number =>
    CHART_TOP + ((maxY - value) / (maxY - minY)) * plotHeight;

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const value = maxY - ratio * (maxY - minY);
    const y = CHART_TOP + ratio * plotHeight;
    return { value, y };
  });

  const labelIndexes = Array.from(
    new Set([
      0,
      Math.floor((timestamps.length - 1) * 0.33),
      Math.floor((timestamps.length - 1) * 0.66),
      timestamps.length - 1,
    ])
  );

  const xLabels = labelIndexes.map((index) => ({
    x: xForIndex(index),
    label: formatTimestampLabel(timestamps[index], range),
  }));

  const series: ChartSeries[] = rawSeries.map((entry) => {
    const path = buildPath(entry.values, xForIndex, yForValue);
    const nonNull = entry.values.filter((value): value is number => value !== null);
    const lastChange = nonNull.length > 0 ? nonNull[nonNull.length - 1] : null;

    return {
      symbol: entry.symbol,
      name: entry.name,
      color: entry.color,
      path,
      lastChange,
    };
  });

  return {
    series,
    yTicks,
    xLabels,
  };
}

function buildPath(
  values: Array<number | null>,
  xForIndex: (index: number) => number,
  yForValue: (value: number) => number
): string {
  let path = "";
  let openSegment = false;

  values.forEach((value, index) => {
    if (value === null) {
      openSegment = false;
      return;
    }

    const x = xForIndex(index);
    const y = yForValue(value);
    path += `${openSegment ? " L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
    openSegment = true;
  });

  return path;
}

function formatTimestampLabel(timestamp: string, range: MarketHistoryRange): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  if (range === "24h") {
    if (timestamp.includes("T")) {
      return new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    }
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date);
  }

  if (range === "5y" || range === "1y") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatPercent(value: number): string {
  const rounded = Math.abs(value) < 0.005 ? 0 : value;
  return `${rounded >= 0 ? "+" : ""}${rounded.toFixed(2)}%`;
}

