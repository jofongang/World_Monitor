/**
 * World Monitor - API fetch helpers
 *
 * Centralised data fetching for the FastAPI backend.
 * Uses NEXT_PUBLIC_API_URL env var with fallback to localhost:8000.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface ApiResponse<T> {
  items: T[];
}

export interface NewsResponse extends ApiResponse<NewsItem> {
  last_updated: string | null;
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

// ---------------------------------------------------------------------------
// Generic fetcher
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Named exports
// ---------------------------------------------------------------------------

export async function fetchNews(options?: {
  refresh?: boolean;
}): Promise<NewsResponse> {
  const query = options?.refresh ? "?refresh=1" : "";
  return fetchApi<NewsResponse>(`/news${query}`);
}

export async function fetchVideos(options?: {
  refresh?: boolean;
}): Promise<VideoItem[]> {
  const query = options?.refresh ? "?refresh=1" : "";
  return fetchApi<VideoItem[]>(`/videos${query}`);
}

export async function fetchMarkets(): Promise<MarketItem[]> {
  return fetchApi<MarketItem[]>('/markets');
}

export async function fetchMarketHistory(
  range: MarketHistoryRange
): Promise<MarketHistoryResponse> {
  const query = encodeURIComponent(range);
  return fetchApi<MarketHistoryResponse>(`/markets/history?range=${query}`);
}

export async function fetchProviderHealth(): Promise<ProviderHealthResponse> {
  return fetchApi<ProviderHealthResponse>("/health/providers");
}

export async function fetchWatchlist(): Promise<Watchlist> {
  return fetchApi<Watchlist>("/watchlist");
}

export async function saveWatchlist(payload: Watchlist): Promise<Watchlist> {
  return fetchApi<Watchlist>("/watchlist", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchAlerts(sinceHours = 24): Promise<AlertsResponse> {
  const clamped = Math.max(1, Math.floor(sinceHours));
  return fetchApi<AlertsResponse>(`/alerts?since_hours=${clamped}`);
}

export async function fetchBrief(window: BriefWindow): Promise<BriefResponse> {
  return fetchApi<BriefResponse>(`/brief?window=${encodeURIComponent(window)}`);
}

export async function fetchHealth(): Promise<{
  status: string;
}> {
  return fetchApi('/health');
}
