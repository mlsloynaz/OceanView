import type { CatalogTicker, CatalogTickersResponse } from "../types";
import { apiFetch, errorMessageFromBody, getApiBaseUrl, readResponseBody } from "@/shared/api/api-fetch";

const MOCK_DELAY_MS = 200;

const API_BASE = getApiBaseUrl();
const USE_MOCK = import.meta.env.VITE_USE_MOCK_CANDLES === "true";

let mockCatalog: CatalogTicker[] = [
  { symbol: "AAPL", name: "Apple Inc.", isFavorite: true, active: true, isOperationEnable: true },
  { symbol: "MSFT", name: "Microsoft Corp.", isFavorite: true, active: true, isOperationEnable: true },
  { symbol: "NVDA", name: "NVIDIA Corp.", isFavorite: true, active: true, isOperationEnable: false },
  { symbol: "TSLA", name: "Tesla Inc.", isFavorite: false, active: false, isOperationEnable: true },
  { symbol: "AMD", name: "Advanced Micro Devices", isFavorite: false, active: true, isOperationEnable: true },
];

function delay(ms = MOCK_DELAY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new Error("VITE_API_BASE_URL is not set.");
  }
  const response = await apiFetch(path, init);
  const body = await readResponseBody(response);
  if (!response.ok) {
    throw new Error(errorMessageFromBody(body, `HTTP ${response.status}`));
  }
  return body as T;
}

function mapTicker(row: {
  symbol: string;
  name?: string | null;
  isFavorite?: boolean;
  active?: boolean;
  isOperationEnable?: boolean;
}): CatalogTicker {
  return {
    symbol: row.symbol.toUpperCase(),
    name: row.name ?? null,
    isFavorite: Boolean(row.isFavorite),
    active: row.active !== false,
    isOperationEnable: row.isOperationEnable !== false,
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
  return patchTicker(symbol, { active });
}

export async function patchTickerOperationEnable(
  symbol: string,
  isOperationEnable: boolean,
): Promise<CatalogTicker> {
  return patchTicker(symbol, { isOperationEnable });
}

async function patchTicker(
  symbol: string,
  fields: { active?: boolean; isOperationEnable?: boolean },
): Promise<CatalogTicker> {
  const upper = symbol.trim().toUpperCase();
  if (!upper) {
    throw new Error("Symbol is required.");
  }
  if (fields.active === undefined && fields.isOperationEnable === undefined) {
    throw new Error("active or isOperationEnable is required.");
  }
  if (USE_MOCK) {
    await delay();
    const index = mockCatalog.findIndex((row) => row.symbol === upper);
    if (index < 0) {
      throw new Error(`Unknown symbol: ${upper}`);
    }
    mockCatalog[index] = { ...mockCatalog[index], ...fields };
    return { ...mockCatalog[index] };
  }
  const payload = await fetchJson<CatalogTicker>(`/tickers/${encodeURIComponent(upper)}`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
  return mapTicker(payload);
}

export async function patchTickersActive(
  symbols: string[],
  active: boolean,
): Promise<CatalogTicker[]> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return [];
  const results = await Promise.all(unique.map((symbol) => patchTickerActive(symbol, active)));
  return results;
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
