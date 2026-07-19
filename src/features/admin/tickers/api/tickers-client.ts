import type {
  CatalogTicker,
  CatalogTickersResponse,
  TickerMovementProfileEntry,
} from "../types";
import type { MovementProfile } from "@/features/premarket/types";
import { apiFetch, errorMessageFromBody, getApiBaseUrl, readResponseBody } from "@/shared/api/api-fetch";

const MOCK_DELAY_MS = 200;

const API_BASE = getApiBaseUrl();
const USE_MOCK = import.meta.env.VITE_USE_MOCK_CANDLES === "true";

let mockCatalog: CatalogTicker[] = [
  { symbol: "AAPL", name: "Apple Inc.", isFavorite: true, active: true },
  { symbol: "MSFT", name: "Microsoft Corp.", isFavorite: true, active: true },
  { symbol: "NVDA", name: "NVIDIA Corp.", isFavorite: true, active: true },
  { symbol: "TSLA", name: "Tesla Inc.", isFavorite: false, active: false },
  { symbol: "AMD", name: "Advanced Micro Devices", isFavorite: false, active: true },
];

const MOCK_PROFILES: Record<string, MovementProfile> = {
  AAPL: {
    timeframe: "1h",
    sampleSize: 18,
    horizonBars: 20,
    historyStart: "2025-07-01T00:00:00Z",
    historyEnd: "2026-07-01T00:00:00Z",
    moveCapPct: 1.85,
    stretchMoveCapPct: 2.6,
    expectedMfePct: 1.85,
    expectedMaePct: 0.42,
    expectedExitPrice: 214.2,
    stretchExitPrice: 216.1,
    referencePrice: 210.3,
    sequenceEntryPrice: 208.5,
    remainingMfePct: 1.1,
    currentMfePct: 0.75,
    exhaustionRisk: false,
    reachProb: { "5": 0.22, "10": 0.08, "12": 0.05, "15": 0.02, "20": 0.01 },
    maDistance: {
      ma20DistancePct: 0.9,
      ma20DistancePercentile: 55,
      typicalMa20DistancePct: 0.7,
      ma40DistancePct: 1.4,
      ma40DistancePercentile: 48,
      typicalMa40DistancePct: 1.2,
      maStackSepPct: 0.55,
      maStackSepPercentile: 40,
      typicalMaStackSepPct: 0.5,
      maExtended: false,
    },
    warnings: [],
  },
  MSFT: {
    timeframe: "1h",
    sampleSize: 12,
    moveCapPct: 1.4,
    stretchMoveCapPct: 2.1,
    expectedMaePct: 0.35,
    expectedExitPrice: 428.5,
    stretchExitPrice: 431.2,
    referencePrice: 422.0,
    exhaustionRisk: false,
    reachProb: { "5": 0.18, "10": 0.05, "12": 0.03, "15": 0.01, "20": 0 },
    warnings: ["small breakout sample (12)"],
  },
};

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

export async function createTicker(input: {
  symbol: string;
  name?: string | null;
  active?: boolean;
  isFavorite?: boolean;
}): Promise<CatalogTicker> {
  const upper = input.symbol.trim().toUpperCase();
  if (!upper) {
    throw new Error("Symbol is required.");
  }
  if (USE_MOCK) {
    await delay();
    if (mockCatalog.some((row) => row.symbol === upper)) {
      throw new Error(`Ticker already exists: ${upper}`);
    }
    const created: CatalogTicker = {
      symbol: upper,
      name: input.name?.trim() ? input.name.trim() : null,
      isFavorite: Boolean(input.isFavorite),
      active: input.active !== false,
    };
    mockCatalog = [...mockCatalog, created];
    return { ...created };
  }
  const payload = await fetchJson<CatalogTicker>("/tickers", {
    method: "POST",
    body: JSON.stringify({
      symbol: upper,
      ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      active: input.active !== false,
      isFavorite: Boolean(input.isFavorite),
    }),
  });
  return mapTicker(payload);
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
  const payload = await fetchJson<CatalogTicker>(`/tickers/${encodeURIComponent(upper)}`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
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

/** Lazy-load stored movement profile(s) for Admin Tickers expand. */
export async function fetchMovementProfilesForSymbols(
  symbols: string[],
): Promise<TickerMovementProfileEntry[]> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return [];

  if (USE_MOCK) {
    await delay(180);
    return unique.map((symbol) => {
      const profile = MOCK_PROFILES[symbol] ?? null;
      return {
        symbol,
        outcome: profile ? "success" : "unknown",
        message: profile ? null : "No stored movement profile yet",
        updatedAt: profile ? "2026-07-18T14:00:00Z" : null,
        historyBars: profile ? 1600 : null,
        profile,
      };
    });
  }

  const payload = await fetchJson<{ symbols?: TickerMovementProfileEntry[] }>(
    "/candles/movement-profiles/status",
    {
      method: "POST",
      body: JSON.stringify({ tickers: unique }),
    },
  );
  return (payload.symbols ?? []).map((row) => ({
    symbol: String(row.symbol || "").toUpperCase(),
    outcome: row.outcome || "unknown",
    message: row.message ?? null,
    updatedAt: row.updatedAt ?? null,
    historyBars: row.historyBars ?? null,
    profile: row.profile ?? null,
  }));
}
