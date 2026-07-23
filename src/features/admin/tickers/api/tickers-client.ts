import type {
  BestFitWatchlistResponse,
  CatalogTicker,
  CatalogTickersResponse,
  TickerMovementProfileEntry,
  TradableWatchlistResponse,
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

let mockBestFit: BestFitWatchlistResponse = {
  kind: "best_fit_watchlist",
  resolvedAt: null,
  limit: 10,
  universeSize: 0,
  scoredCount: 0,
  skippedCount: 0,
  watchlist: [],
  skipped: [],
  message: "No best-fit watchlist resolved yet. Run Resolve best-fit watchlist.",
};

let mockTradable: TradableWatchlistResponse = {
  kind: "tradable_watchlist",
  resolvedAt: null,
  limit: 5,
  sourceLimit: 10,
  sourceCount: 0,
  scoredCount: 0,
  skippedCount: 0,
  sourceSymbols: [],
  watchlist: [],
  skipped: [],
  message: "No tradable top 5 yet. Resolve best-fit 10, then Refine tradable top 5.",
};

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

export async function getBestFitWatchlist(): Promise<BestFitWatchlistResponse> {
  if (USE_MOCK) {
    await delay();
    return {
      ...mockBestFit,
      watchlist: [...mockBestFit.watchlist],
      skipped: [...mockBestFit.skipped],
    };
  }
  return fetchJson<BestFitWatchlistResponse>("/tickers/best-fit");
}

export async function resolveBestFitWatchlist(input?: {
  limit?: number;
  activateTop?: boolean;
}): Promise<BestFitWatchlistResponse> {
  const limit = input?.limit ?? 10;
  const activateTop = Boolean(input?.activateTop);

  if (USE_MOCK) {
    await delay(250);
    const watchlist = mockCatalog
      .slice(0, Math.min(limit, mockCatalog.length))
      .map((row, index) => ({
        rank: index + 1,
        symbol: row.symbol,
        name: row.name,
        currentlyActive: activateTop ? true : row.active,
        score: 80 - index * 4,
        tier: index < 2 ? "excellent" : index < 4 ? "strong" : "moderate",
        reasons: [`+mock score for ${row.symbol}`],
        metrics: {
          sampleSize: 16,
          moveCapPct: 1.6,
          expectedMaePct: 0.4,
          winRate: 0.58,
          atrPct: 1.0,
          suggestedStopPct: 0.65,
        },
      }));
    if (activateTop) {
      const keep = new Set(watchlist.map((row) => row.symbol));
      mockCatalog = mockCatalog.map((row) => ({ ...row, active: keep.has(row.symbol) }));
    }
    mockBestFit = {
      kind: "best_fit_watchlist",
      resolvedAt: new Date().toISOString(),
      limit,
      universeSize: mockCatalog.length,
      scoredCount: watchlist.length,
      skippedCount: Math.max(0, mockCatalog.length - watchlist.length),
      watchlist,
      skipped: mockCatalog
        .filter((row) => !watchlist.some((w) => w.symbol === row.symbol))
        .map((row) => ({ symbol: row.symbol, reason: "Mock: outside top N" })),
      activation: activateTop
        ? { applied: true, activated: watchlist.map((w) => w.symbol), deactivated: [] }
        : null,
      message: `Best-fit watchlist: top ${watchlist.length} (mock).`,
    };
    return {
      ...mockBestFit,
      watchlist: [...mockBestFit.watchlist],
      skipped: [...mockBestFit.skipped],
    };
  }

  return fetchJson<BestFitWatchlistResponse>("/tickers/best-fit/resolve", {
    method: "POST",
    body: JSON.stringify({ limit, activateTop }),
  });
}

export async function getTradableWatchlist(): Promise<TradableWatchlistResponse> {
  if (USE_MOCK) {
    await delay();
    return {
      ...mockTradable,
      watchlist: [...mockTradable.watchlist],
      skipped: [...mockTradable.skipped],
    };
  }
  return fetchJson<TradableWatchlistResponse>("/tickers/tradable");
}

export async function refineTradableWatchlist(input?: {
  limit?: number;
  activateTop?: boolean;
  force?: boolean;
  maxSamples?: number;
}): Promise<TradableWatchlistResponse> {
  const limit = input?.limit ?? 5;
  const activateTop = Boolean(input?.activateTop);
  const force = Boolean(input?.force);

  if (USE_MOCK) {
    await delay(300);
    if (!mockBestFit.watchlist.length) {
      throw new Error("No best-fit watchlist yet. Resolve best-fit (top 10) first.");
    }
    const source = mockBestFit.watchlist.slice(0, 10);
    const progress = source.map((row, index) => ({
      symbol: row.symbol,
      name: row.name,
      stockRank: row.rank,
      stockScore: row.score,
      sampleCount: Math.min(8, index + 3),
      minSamplesReady: 8,
      ready: index + 3 >= 8,
      lastSampleAt: new Date().toISOString(),
      typicalBidAskDollars: 0.05,
      typicalBidAskPct: 0.03,
      underlyingMoveDollarsForOption12Pct: 0.35,
      underlyingMovePctForOption12Pct: 0.4,
    }));
    const ready = progress.filter((row) => row.ready);
    const watchlist = ready.slice(0, Math.min(limit, ready.length)).map((row, index) => ({
      rank: index + 1,
      symbol: row.symbol,
      name: row.name,
      stockRank: row.stockRank,
      stockScore: row.stockScore ?? undefined,
      score: 78 - index * 3,
      tier: index < 2 ? "excellent" : "strong",
      reasons: [`+mock tradability for ${row.symbol}`],
      call: {
        eligible: true,
        score: 75,
        metrics: {
          contractCount: 6,
          medianSpreadPct: 0.03,
          medianVolume: 250,
          medianOpenInterest: 900,
        },
      },
      put: {
        eligible: true,
        score: 72,
        metrics: {
          contractCount: 5,
          medianSpreadPct: 0.035,
          medianVolume: 180,
          medianOpenInterest: 700,
        },
      },
    }));
    if (activateTop && watchlist.length) {
      const keep = new Set(watchlist.map((row) => row.symbol));
      mockCatalog = mockCatalog.map((row) => ({ ...row, active: keep.has(row.symbol) }));
    }
    mockTradable = {
      kind: "tradable_watchlist",
      status: watchlist.length >= limit ? "ready" : "collecting",
      resolvedAt: watchlist.length >= limit ? new Date().toISOString() : null,
      collectedAt: new Date().toISOString(),
      limit,
      sourceLimit: 10,
      sourceCount: source.length,
      minSamplesReady: 8,
      maxSamplesPerRun: 3,
      readyCount: ready.length,
      scoredCount: watchlist.length,
      skippedCount: 0,
      sourceSymbols: source.map((row) => row.symbol),
      bestFitResolvedAt: mockBestFit.resolvedAt,
      progress,
      sampledThisRun: progress.slice(0, 3).map((row) => ({
        symbol: row.symbol,
        sampleCount: row.sampleCount,
        ready: row.ready,
        typicalBidAskDollars: row.typicalBidAskDollars,
        underlyingMoveDollarsForOption12Pct: row.underlyingMoveDollarsForOption12Pct,
      })),
      errors: [],
      watchlist,
      skipped: [],
      activation: activateTop
        ? { applied: true, activated: watchlist.map((w) => w.symbol), deactivated: [] }
        : null,
      message:
        watchlist.length >= limit
          ? `Tradable top ${watchlist.length} ready (mock).`
          : `Collected samples (mock). Progress: ${ready.length}/${source.length} ready.`,
    };
    return {
      ...mockTradable,
      watchlist: [...mockTradable.watchlist],
      skipped: [...mockTradable.skipped],
      progress: [...(mockTradable.progress ?? [])],
    };
  }

  return fetchJson<TradableWatchlistResponse>("/tickers/tradable/refine", {
    method: "POST",
    body: JSON.stringify({
      limit,
      activateTop,
      force,
      ...(input?.maxSamples != null ? { maxSamples: input.maxSamples } : {}),
    }),
  });
}
