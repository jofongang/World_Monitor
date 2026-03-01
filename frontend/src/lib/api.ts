/**
 * World Monitor - API fetch helpers
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "/wm-api").replace(/\/+$/, "");

export interface NewsItem {
  id: number;
  title: string;
  source: string;
  url: string;
  published_at: string;
  category: string;
  region: string;
  country: string;
  lat: number | null;
  lon: number | null;
  location_label: string | null;
}

export interface VideoItem {
  id: string;
  title: string;
  source: string;
  url: string;
  published_at: string;
  topic: string;
  thumbnail: string | null;
  provider: string;
  description: string;
}

export interface MarketItem {
  symbol: string;
  name: string;
  price: number | null;
  change_pct: number | null;
  as_of: string;
  provider: string;
  error: string | null;
}

export interface PredictionMarketItem {
  id: string;
  provider: "Polymarket" | "Kalshi" | string;
  ticker: string | null;
  title: string;
  subtitle: string | null;
  category: string;
  url: string | null;
  status: string;
  yes_price: number | null;
  no_price: number | null;
  last_price: number | null;
  volume_24h: number | null;
  volume_total: number | null;
  liquidity: number | null;
  open_interest: number | null;
  close_time: string | null;
  updated_at: string;
}

export interface PredictionMarketSourceStatus {
  name: string;
  ok: boolean;
  fetched: number;
  last_error: string | null;
}

export interface PredictionMarketsResponse {
  items: PredictionMarketItem[];
  sources: PredictionMarketSourceStatus[];
  last_updated: string | null;
}

export interface PredictionMarketStatusResponse {
  active_markets: number;
  total_markets: number;
  healthy_sources: number;
  total_sources: number;
  last_updated: string | null;
  sources: PredictionMarketSourceStatus[];
}

export type MarketHistoryRange = "24h" | "7d" | "1m" | "6m" | "1y" | "5y";

export interface MarketHistoryPoint {
  timestamp: string;
  price: number;
}

export interface MarketHistorySeries {
  symbol: string;
  name: string;
  points: MarketHistoryPoint[];
}

export interface MarketHistoryResponse {
  range: MarketHistoryRange;
  series: MarketHistorySeries[];
}

export interface ProviderHealthItem {
  ok: boolean;
  last_success_at: string | null;
  last_error: string | null;
}

export type ProviderHealthResponse = Record<string, ProviderHealthItem>;

export interface Watchlist {
  countries: string[];
  topics: string[];
  keywords: string[];
}

export type AlertSeverity = "High" | "Medium" | "Low";

export interface AlertItem {
  id: number;
  title: string;
  url: string;
  published_at: string;
  country: string;
  topic: string;
  severity: AlertSeverity;
  matched_rules: string[];
}

export interface AlertsResponse {
  generated_at: string;
  since_hours: number;
  items: AlertItem[];
}

export type BriefWindow = "24h" | "7d";

export interface BriefRegionItem {
  title: string;
  country: string;
  topic: string;
  published_at: string;
  url: string;
}

export type BriefByRegion = Record<string, BriefRegionItem[]>;

export interface BriefResponse {
  generated_at: string;
  window: BriefWindow;
  top_alerts: AlertItem[];
  by_region: BriefByRegion;
  markets_snapshot: MarketItem[];
  one_paragraph_summary: string;
}

export type EventCategory =
  | "conflict"
  | "diplomacy"
  | "sanctions"
  | "cyber"
  | "disaster"
  | "markets"
  | "other";

export interface EventItem {
  id: string;
  external_id: string;
  source: string;
  source_url: string;
  title: string;
  summary: string;
  body_snippet: string;
  category: EventCategory;
  tags: string[];
  country: string;
  region: string;
  lat: number | null;
  lon: number | null;
  geohash: string | null;
  severity: number;
  confidence: number;
  occurred_at: string;
  started_at: string | null;
  ingested_at: string;
  updated_at: string;
  cluster_id: string;
  raw: Record<string, unknown>;
}

export interface EventsResponse {
  items: EventItem[];
  meta: {
    count: number;
    since_hours: number;
    refreshed: boolean;
    run_summary: JobRunSummary | null;
    generated_at: string;
  };
}

export interface EventDetailResponse {
  event: EventItem;
  related: EventItem[];
}

export interface TimelineItem {
  bucket_time: string;
  event_count: number;
  avg_severity: number;
}

export interface HotspotItem {
  country: string;
  region: string;
  event_count: number;
  avg_severity: number;
  latest_at: string;
}

export interface PulseItem {
  country: string;
  recent_count: number;
  baseline_count: number;
  delta_ratio: number;
}

export interface ConnectorStatusItem {
  name: string;
  enabled: boolean;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error: string | null;
  next_run_at: string | null;
  items_fetched: number;
  last_duration_ms: number;
  updated_at: string;
}

export interface IngestionLogItem {
  id: number;
  created_at: string;
  level: string;
  connector: string;
  message: string;
}

export interface JobRunSummary {
  status: string;
  ingested: number;
  alerts_fired?: number;
  connectors?: Array<{
    name: string;
    items: number;
    duration_ms: number;
    error: string | null;
  }>;
  started_at?: string;
  finished_at?: string;
  error?: string;
}

export interface JobStatus {
  running: boolean;
  refresh_minutes: number;
  last_run_started_at: string | null;
  last_run_finished_at: string | null;
  last_error: string | null;
  last_ingested_count: number;
  next_run_at: string | null;
}

export interface JobStatusResponse {
  job: JobStatus;
  stats: {
    total_events: number;
    events_24h: number;
    open_alerts: number;
    latest_event_at: string | null;
  };
  generated_at: string;
}

export interface ReadyResponse {
  status: "ok" | "degraded";
  checked_at: string;
  sources_total: number;
  sources_healthy: number;
  job: JobStatus;
}

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  countries: string[];
  regions: string[];
  categories: string[];
  keywords: string[];
  severity_threshold: number;
  spike_detection: boolean;
  action_in_app: boolean;
  action_webhook_url: string | null;
  action_slack_webhook: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertInboxItem {
  alert_event_id: string;
  rule_id: string;
  rule_name: string;
  event_id: string;
  status: "new" | "acked" | "resolved";
  fired_at: string;
  acked_at: string | null;
  resolved_at: string | null;
  title: string;
  source: string;
  source_url: string;
  category: string;
  country: string;
  region: string;
  severity: number;
  confidence: number;
  occurred_at: string;
  cluster_id: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  query: string;
  filters: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

async function fetchApi<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export async function fetchNews(options?: {
  refresh?: boolean;
}): Promise<{
  items: NewsItem[];
  last_updated: string | null;
}> {
  const query = options?.refresh ? "?refresh=1" : "";
  return fetchApi(`/news${query}`);
}

export async function fetchVideos(options?: {
  refresh?: boolean;
}): Promise<VideoItem[]> {
  const query = options?.refresh ? "?refresh=1" : "";
  return fetchApi(`/videos${query}`);
}

export async function fetchMarkets(): Promise<MarketItem[]> {
  return fetchApi("/markets");
}

export async function fetchPredictionMarkets(options?: {
  refresh?: boolean;
}): Promise<PredictionMarketsResponse> {
  const query = options?.refresh ? "?refresh=1" : "";
  return fetchApi(`/prediction-markets${query}`);
}

export async function fetchPredictionMarketStatus(): Promise<PredictionMarketStatusResponse> {
  return fetchApi("/prediction-markets/status");
}

export async function fetchMarketHistory(
  range: MarketHistoryRange
): Promise<MarketHistoryResponse> {
  return fetchApi(`/markets/history?range=${encodeURIComponent(range)}`);
}

export async function fetchProviderHealth(): Promise<ProviderHealthResponse> {
  return fetchApi("/health/providers");
}

export async function fetchWatchlist(): Promise<Watchlist> {
  return fetchApi("/watchlist");
}

export async function saveWatchlist(payload: Watchlist): Promise<Watchlist> {
  return fetchApi("/watchlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchAlerts(sinceHours = 24): Promise<AlertsResponse> {
  const clamped = Math.max(1, Math.floor(sinceHours));
  return fetchApi(`/alerts?since_hours=${clamped}`);
}

export async function fetchBrief(window: BriefWindow): Promise<BriefResponse> {
  return fetchApi(`/brief?window=${encodeURIComponent(window)}`);
}

export async function fetchHealth(): Promise<{ status: string }> {
  return fetchApi("/health");
}

export async function fetchReady(): Promise<ReadyResponse> {
  return fetchApi("/ready");
}

export async function fetchEvents(params?: {
  limit?: number;
  sinceHours?: number;
  category?: string;
  region?: string;
  country?: string;
  query?: string;
  refresh?: boolean;
}): Promise<EventsResponse> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.sinceHours) search.set("since_hours", String(params.sinceHours));
  if (params?.category) search.set("category", params.category);
  if (params?.region) search.set("region", params.region);
  if (params?.country) search.set("country", params.country);
  if (params?.query) search.set("q", params.query);
  if (params?.refresh) search.set("refresh", "1");
  const query = search.toString();
  return fetchApi(`/events${query ? `?${query}` : ""}`);
}

export async function fetchEventDetail(eventId: string): Promise<EventDetailResponse> {
  return fetchApi(`/events/${encodeURIComponent(eventId)}`);
}

export async function fetchTimeline(params?: {
  sinceHours?: number;
  bucketMinutes?: number;
}): Promise<{ items: TimelineItem[]; generated_at: string }> {
  const search = new URLSearchParams();
  if (params?.sinceHours) search.set("since_hours", String(params.sinceHours));
  if (params?.bucketMinutes) search.set("bucket_minutes", String(params.bucketMinutes));
  const query = search.toString();
  return fetchApi(`/events/timeline${query ? `?${query}` : ""}`);
}

export async function fetchHotspots(
  sinceHours = 24,
  limit = 12
): Promise<{ items: HotspotItem[] }> {
  return fetchApi(`/events/hotspots?since_hours=${sinceHours}&limit=${limit}`);
}

export async function fetchPulse(params?: {
  windowHours?: number;
  baselineHours?: number;
}): Promise<{
  items: PulseItem[];
  window_hours: number;
  baseline_hours: number;
}> {
  const windowHours = params?.windowHours ?? 6;
  const baselineHours = params?.baselineHours ?? 24;
  return fetchApi(`/events/pulse?window_hours=${windowHours}&baseline_hours=${baselineHours}`);
}

export async function fetchSources(): Promise<{
  items: ConnectorStatusItem[];
  generated_at: string;
}> {
  return fetchApi("/sources");
}

export async function fetchJobStatus(): Promise<JobStatusResponse> {
  return fetchApi("/jobs/status");
}

export async function fetchJobLogs(limit = 120): Promise<{ items: IngestionLogItem[] }> {
  return fetchApi(`/jobs/logs?limit=${Math.max(1, Math.floor(limit))}`);
}

export async function runJobs(): Promise<JobRunSummary> {
  return fetchApi("/jobs/run", { method: "POST" });
}

export async function fetchSystemHealth(): Promise<{
  status: string;
  checked_at: string;
  job: JobStatus;
  stats: JobStatusResponse["stats"];
  sources: ConnectorStatusItem[];
}> {
  return fetchApi("/health/system");
}

export async function fetchAlertRules(): Promise<{ items: AlertRule[] }> {
  return fetchApi("/alerts/rules");
}

export async function saveAlertRule(payload: Partial<AlertRule>): Promise<{
  item: AlertRule;
}> {
  return fetchApi("/alerts/rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchAlertInbox(params?: {
  status?: "new" | "acked" | "resolved";
  limit?: number;
}): Promise<{ items: AlertInboxItem[] }> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return fetchApi(`/alerts/inbox${query ? `?${query}` : ""}`);
}

export async function ackAlert(alertEventId: string): Promise<{ status: string }> {
  return fetchApi(`/alerts/inbox/${encodeURIComponent(alertEventId)}/ack`, {
    method: "POST",
  });
}

export async function resolveAlert(alertEventId: string): Promise<{ status: string }> {
  return fetchApi(`/alerts/inbox/${encodeURIComponent(alertEventId)}/resolve`, {
    method: "POST",
  });
}

export async function fetchSavedQueries(): Promise<{ items: SavedQuery[] }> {
  return fetchApi("/queries");
}

export async function saveQuery(payload: {
  id?: string;
  name: string;
  query: string;
  filters?: Record<string, unknown>;
}): Promise<{ item: SavedQuery }> {
  return fetchApi("/queries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteQuery(queryId: string): Promise<{ status: string }> {
  return fetchApi(`/queries/${encodeURIComponent(queryId)}`, {
    method: "DELETE",
  });
}
