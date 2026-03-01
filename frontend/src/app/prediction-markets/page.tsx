"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Chip from "@/components/ui/Chip";
import Kpi from "@/components/ui/Kpi";
import Panel from "@/components/ui/Panel";
import {
  fetchPredictionMarkets,
  type PredictionMarketItem,
  type PredictionMarketSourceStatus,
} from "@/lib/api";

const REFRESH_INTERVAL_MS = 60_000;

type ProviderFilter = "all" | "Polymarket" | "Kalshi";
type StatusFilter = "all" | "active" | "closed";
type SortKey = "volume_24h" | "volume_total" | "liquidity" | "yes_price" | "close_time";

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "volume_24h", label: "24H Volume" },
  { key: "volume_total", label: "Total Volume" },
  { key: "liquidity", label: "Liquidity" },
  { key: "yes_price", label: "YES Price" },
  { key: "close_time", label: "Close Time" },
];

export default function PredictionMarketsPage() {
  const [items, setItems] = useState<PredictionMarketItem[]>([]);
  const [sources, setSources] = useState<PredictionMarketSourceStatus[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("volume_24h");
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(
    Math.floor(REFRESH_INTERVAL_MS / 1000)
  );

  const load = useCallback(async (force: boolean) => {
    if (force) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      setError(null);
      const payload = await fetchPredictionMarkets({ refresh: force });
      setItems(payload.items);
      setSources(payload.sources);
      setLastUpdated(payload.last_updated);
      setSecondsUntilRefresh(Math.floor(REFRESH_INTERVAL_MS / 1000));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load prediction markets.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
    const timer = setInterval(() => void load(false), REFRESH_INTERVAL_MS);
    const countdown = setInterval(() => {
      setSecondsUntilRefresh((value) => (value <= 1 ? Math.floor(REFRESH_INTERVAL_MS / 1000) : value - 1));
    }, 1000);
    return () => {
      clearInterval(timer);
      clearInterval(countdown);
    };
  }, [load]);

  const categoryOptions = useMemo(() => {
    return ["all", ...new Set(items.map((item) => item.category).filter(Boolean))];
  }, [items]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items
      .filter((item) => {
        if (providerFilter !== "all" && item.provider !== providerFilter) {
          return false;
        }
        if (statusFilter === "active" && !isActiveStatus(item.status)) {
          return false;
        }
        if (statusFilter === "closed" && isActiveStatus(item.status)) {
          return false;
        }
        if (categoryFilter !== "all" && item.category !== categoryFilter) {
          return false;
        }
        if (!normalizedQuery) {
          return true;
        }
        const haystack = [
          item.title,
          item.subtitle,
          item.ticker,
          item.provider,
          item.category,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .sort((left, right) => compareMarkets(left, right, sortKey));
  }, [items, providerFilter, statusFilter, categoryFilter, query, sortKey]);

  const kpis = useMemo(() => {
    const openCount = filtered.filter((item) => isActiveStatus(item.status)).length;
    const yesPrices = filtered
      .map((item) => item.yes_price)
      .filter((value): value is number => typeof value === "number");
    const avgYes = yesPrices.length
      ? yesPrices.reduce((acc, value) => acc + value, 0) / yesPrices.length
      : null;
    const volume24h = filtered.reduce(
      (acc, item) => acc + (typeof item.volume_24h === "number" ? item.volume_24h : 0),
      0
    );
    const topConviction = filtered
      .map((item) => ({
        title: item.title,
        yes: item.yes_price,
      }))
      .filter((item): item is { title: string; yes: number } => typeof item.yes === "number")
      .sort((a, b) => Math.abs(b.yes - 50) - Math.abs(a.yes - 50))[0];

    return {
      total: filtered.length,
      open: openCount,
      avgYes,
      volume24h,
      topConviction,
    };
  }, [filtered]);

  const providerVolume = useMemo(() => buildProviderVolume(filtered), [filtered]);
  const categoryBreakdown = useMemo(() => buildCategoryBreakdown(filtered), [filtered]);
  const convictionLeaders = useMemo(() => buildConvictionLeaders(filtered), [filtered]);

  return (
    <div className="space-y-4">
      <Panel
        title="Prediction Markets"
        subtitle="Polymarket + Kalshi monitoring board"
        rightSlot={
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted">
              auto {secondsUntilRefresh}s
            </span>
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="rounded border border-accent/40 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>
        }
        contentClassName="space-y-3 px-4 pb-4"
      >
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          <Kpi label="Visible Markets" value={String(kpis.total)} />
          <Kpi label="Open Markets" value={String(kpis.open)} />
          <Kpi
            label="Avg YES Price"
            value={kpis.avgYes === null ? "N/A" : `${kpis.avgYes.toFixed(2)}%`}
          />
          <Kpi label="24H Volume" value={formatCompact(kpis.volume24h)} />
          <Kpi
            label="Top Conviction"
            value={
              kpis.topConviction?.yes !== undefined
                ? `${kpis.topConviction.yes.toFixed(1)}%`
                : "N/A"
            }
          />
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted">
              Provider
            </span>
            {(["all", "Polymarket", "Kalshi"] as const).map((provider) => (
              <Chip
                key={provider}
                active={providerFilter === provider}
                onClick={() => setProviderFilter(provider)}
              >
                {provider}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted">
              Category
            </span>
            {categoryOptions.map((category) => (
              <Chip
                key={category}
                active={categoryFilter === category}
                onClick={() => setCategoryFilter(category)}
              >
                {category}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted">
              Status
            </span>
            {(["all", "active", "closed"] as const).map((status) => (
              <Chip
                key={status}
                active={statusFilter === status}
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted">
              Sort
            </span>
            {SORT_OPTIONS.map((option) => (
              <Chip
                key={option.key}
                active={sortKey === option.key}
                onClick={() => setSortKey(option.key)}
              >
                {option.label}
              </Chip>
            ))}
          </div>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, ticker, category, provider..."
            className="w-full rounded border border-border bg-background/70 px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-accent"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-[0.12em] text-muted">
          <span>Last updated: {formatTimestamp(lastUpdated)}</span>
          <span>Source health: {sources.filter((source) => source.ok).length}/{sources.length || 2}</span>
        </div>

        {error ? (
          <div className="rounded border border-warning/35 bg-warning/10 px-2.5 py-2 text-[11px] font-mono text-warning">
            {error}
          </div>
        ) : null}
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr,360px]">
        <Panel
          title="Market Feed"
          subtitle="Sorted contract tape with live pricing and liquidity"
          contentClassName="px-4 pb-4"
        >
          {loading ? (
            <p className="text-xs font-mono text-muted">Loading prediction markets...</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs font-mono text-muted">No markets match current filters.</p>
          ) : (
            <div className="terminal-scroll max-h-[760px] space-y-2 overflow-y-auto pr-1">
              {filtered.map((item) => (
                <article
                  key={item.id}
                  className="rounded border border-border bg-background/45 p-2.5 hover:border-accent/35"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm leading-snug text-foreground">
                        {item.title}
                      </p>
                      <p className="mt-1 text-[10px] font-mono text-muted">
                        {item.provider}
                        {item.ticker ? ` | ${item.ticker}` : ""}
                        {item.subtitle ? ` | ${item.subtitle}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <CategoryBadge category={item.category} />
                      <StatusBadge status={item.status} />
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-mono sm:grid-cols-4">
                    <MetricCell label="YES" value={formatPercent(item.yes_price)} positive />
                    <MetricCell label="NO" value={formatPercent(item.no_price)} />
                    <MetricCell label="LAST" value={formatPercent(item.last_price)} />
                    <MetricCell label="24H VOL" value={formatCompact(item.volume_24h)} />
                    <MetricCell label="TOTAL VOL" value={formatCompact(item.volume_total)} />
                    <MetricCell label="LIQUIDITY" value={formatCompact(item.liquidity)} />
                    <MetricCell label="OPEN INT" value={formatCompact(item.open_interest)} />
                    <MetricCell label="CLOSE" value={formatTimestamp(item.close_time)} />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-muted">
                    <span>Updated: {formatTimestamp(item.updated_at)}</span>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border border-accent/35 px-2 py-1 uppercase tracking-wider text-accent hover:bg-accent/10"
                      >
                        Open
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Signal Deck"
            subtitle="Provider volume, categories, conviction spread"
            contentClassName="space-y-3 px-4 pb-4"
          >
            <BarSection title="24H Volume by Provider" rows={providerVolume} />
            <BarSection title="Market Count by Category" rows={categoryBreakdown} />
            <div>
              <p className="mb-2 text-[10px] font-mono uppercase tracking-wider text-muted">
                Conviction Leaders
              </p>
              <div className="space-y-1.5">
                {convictionLeaders.length === 0 ? (
                  <p className="text-xs font-mono text-muted">No priced markets yet.</p>
                ) : (
                  convictionLeaders.map((item) => (
                    <div
                      key={item.id}
                      className="rounded border border-border bg-background/45 px-2 py-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                        <span className="truncate text-foreground">{item.provider}</span>
                        <span className="text-accent">{item.yes_price.toFixed(2)}%</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted">{item.title}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Panel>

          <Panel
            title="Source Status"
            subtitle="Connector health and fetch diagnostics"
            contentClassName="space-y-2 px-4 pb-4"
          >
            {sources.length === 0 ? (
              <p className="text-xs font-mono text-muted">No source status yet.</p>
            ) : (
              sources.map((source) => (
                <div
                  key={source.name}
                  className="rounded border border-border bg-background/45 px-2.5 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-mono text-foreground">{source.name}</p>
                    <span
                      className={`text-[10px] font-mono uppercase tracking-wider ${
                        source.ok ? "text-positive" : "text-warning"
                      }`}
                    >
                      {source.ok ? "ok" : "degraded"}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] font-mono text-muted">Fetched: {source.fetched}</p>
                  {source.last_error ? (
                    <p className="mt-1 break-words text-[10px] font-mono text-warning">
                      {source.last_error}
                    </p>
                  ) : (
                    <p className="mt-1 text-[10px] font-mono text-muted">No connector error.</p>
                  )}
                </div>
              ))
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const colorClass =
    category === "politics"
      ? "border-accent/35 bg-accent/10 text-accent"
      : category === "macro"
        ? "border-warning/35 bg-warning/10 text-warning"
        : category === "sports"
          ? "border-positive/35 bg-positive/10 text-positive"
          : category === "crypto"
            ? "border-danger/35 bg-danger/10 text-danger"
            : "border-border bg-background/55 text-muted";

  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${colorClass}`}>
      {category}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = isActiveStatus(status);
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${
        active
          ? "border-positive/35 bg-positive/10 text-positive"
          : "border-warning/35 bg-warning/10 text-warning"
      }`}
    >
      {status || "unknown"}
    </span>
  );
}

function MetricCell({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded border border-border/80 bg-background/60 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className={`mt-0.5 ${positive ? "text-positive" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function BarSection({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: number; display: string }>;
}) {
  const maxValue = rows.reduce((acc, row) => Math.max(acc, row.value), 0);

  return (
    <div>
      <p className="mb-2 text-[10px] font-mono uppercase tracking-wider text-muted">{title}</p>
      <div className="space-y-1.5">
        {rows.length === 0 ? (
          <p className="text-xs font-mono text-muted">No data.</p>
        ) : (
          rows.map((row) => {
            const widthPct = maxValue > 0 ? Math.max(8, (row.value / maxValue) * 100) : 8;
            return (
              <div key={row.label} className="rounded border border-border bg-background/45 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                  <span className="text-foreground">{row.label}</span>
                  <span className="text-muted">{row.display}</span>
                </div>
                <div className="mt-1 h-1.5 rounded bg-background">
                  <div
                    className="h-full rounded bg-accent shadow-[0_0_8px_rgba(45,123,255,0.45)]"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function compareMarkets(left: PredictionMarketItem, right: PredictionMarketItem, sortKey: SortKey) {
  if (sortKey === "close_time") {
    const leftTime = left.close_time ? new Date(left.close_time).getTime() : Number.MAX_SAFE_INTEGER;
    const rightTime = right.close_time ? new Date(right.close_time).getTime() : Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime;
  }
  const leftValue = toNumber(left[sortKey]);
  const rightValue = toNumber(right[sortKey]);
  return rightValue - leftValue;
}

function buildProviderVolume(items: PredictionMarketItem[]) {
  const providerMap = new Map<string, number>();
  for (const item of items) {
    providerMap.set(
      item.provider,
      (providerMap.get(item.provider) ?? 0) + (typeof item.volume_24h === "number" ? item.volume_24h : 0)
    );
  }
  return [...providerMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value, display: formatCompact(value) }));
}

function buildCategoryBreakdown(items: PredictionMarketItem[]) {
  const categoryMap = new Map<string, number>();
  for (const item of items) {
    categoryMap.set(item.category, (categoryMap.get(item.category) ?? 0) + 1);
  }
  return [...categoryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value, display: String(value) }));
}

function buildConvictionLeaders(items: PredictionMarketItem[]) {
  return [...items]
    .filter((item): item is PredictionMarketItem & { yes_price: number } => typeof item.yes_price === "number")
    .sort((a, b) => Math.abs(b.yes_price - 50) - Math.abs(a.yes_price - 50))
    .slice(0, 5);
}

function isActiveStatus(status: string): boolean {
  const value = status.trim().toLowerCase();
  return value === "active" || value === "open" || value === "initialized";
}

function toNumber(value: number | null): number {
  return typeof value === "number" && !Number.isNaN(value) ? value : -1;
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "N/A";
  return `${value.toFixed(2)}%`;
}

function formatCompact(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTimestamp(value: string | null): string {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
