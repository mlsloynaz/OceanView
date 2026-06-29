import type { CatalogTicker, CatalogTickersResponse } from "../types";

const MOCK_DELAY_MS = 200;

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "/api";
const USE_MOCK = import.meta.env.VITE_USE_MOCK_CANDLES === "true";

let mockCatalog: CatalogTicker[] = [
  { symbol: "AAPL", name: "Apple Inc.", isFavorite: true, active: true },
  { symbol: "MSFT", name: "Microsoft Corp.", isFavorite: true, active: true },
  { symbol: "NVDA", name: "NVIDIA Corp.", isFavorite: true, active: true },
  { symbol: "TSLA", name: "Tesla Inc.", isFavorite: false, active: false },
  { symbol: "AMD", name: "Advanced Micro Devices", isFavorite: false, active: true },
];

function delay(ms = MOCK_DELAY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new Error("VITE_API_BASE_URL is not set.");
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

function mapTicker(row: {
  symbol: string;
  name?: string | null;
  isFavorite?: boolean;
  active?: boolean;
}): CatalogTicker {
  return {
    symbol: row.symbol.toUpperCase(),
    name: row.name ?? null,
    isFavorite: Boolean(row.isFavorite),
    active: row.active !== false,
  };
}

export function tickersApiUsesMock(): boolean {
  return USE_MOCK;
}

export function tickersApiBaseUrl(): string | null {
  return API_BASE || null;
}

export async function getTickersCatalog(): Promise<CatalogTickersResponse> {
  if (USE_MOCK) {
    await delay();
    return { tickers: mockCatalog.map((row) => ({ ...row })) };
  }
  const payload = await fetchJson<{ tickers: CatalogTicker[] }>("/tickers");
  return { tickers: (payload.tickers ?? []).map(mapTicker) };
}

export async function patchTickerActive(symbol: string, active: boolean): Promise<CatalogTicker> {
  const upper = symbol.trim().toUpperCase();
  if (!upper) {
    throw new Error("Symbol is required.");
  }
  if (USE_MOCK) {
    await delay();
    const index = mockCatalog.findIndex((row) => row.symbol === upper);
    if (index < 0) {
      throw new Error(`Unknown symbol: ${upper}`);
    }
    mockCatalog[index] = { ...mockCatalog[index], active };
    return { ...mockCatalog[index] };
  }
  const payload = await fetchJson<CatalogTicker>(
    `/tickers/${encodeURIComponent(upper)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ active }),
    },
  );
  return mapTicker(payload);
}

/** Active symbols for Candles pane and other admin bulk actions. */
export async function getActiveTickersForAdmin(): Promise<CatalogTickersResponse> {
  if (USE_MOCK) {
    await delay();
    return { tickers: mockCatalog.filter((row) => row.active).map((row) => ({ ...row })) };
  }
  const payload = await fetchJson<{ tickers: CatalogTicker[] }>("/tickers?activeOnly=true");
  return { tickers: (payload.tickers ?? []).map(mapTicker) };
}
