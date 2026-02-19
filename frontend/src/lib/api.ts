/**
 * World Monitor — API fetch helpers
 *
 * Centralised data fetching for the FastAPI backend.
 * Uses NEXT_PUBLIC_API_URL env var with fallback to localhost:8000.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
}

export interface MarketItem {
  symbol: string;
  name: string;
  price: number;
  change_pct: number;
}

interface ApiResponse<T> {
  items: T[];
}

export interface NewsResponse extends ApiResponse<NewsItem> {
  last_updated: string | null;
}

// ---------------------------------------------------------------------------
// Generic fetcher
// ---------------------------------------------------------------------------

async function fetchApi<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, { cache: "no-store" });
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

export async function fetchMarkets(): Promise<MarketItem[]> {
  const data = await fetchApi<ApiResponse<MarketItem>>("/markets");
  return data.items;
}

export async function fetchHealth(): Promise<{
  status: string;
}> {
  return fetchApi("/health");
}
