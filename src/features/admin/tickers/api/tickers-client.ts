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
  ranked: [],
  skipped: [],
  message: "No best-fit ranking yet. Run Resolve on Best-fit.",
};

let mockTradable: TradableWatchlistResponse = {
  kind: "tradable_watchlist",
  resolvedAt: null,
  limit: 5,
  sourceLimit: 10,
  sourceCount: 0,
  scoredCount: 0,
  skippedCount: 0,
  batchSize: 5,
  batchIntervalSeconds: 30,
  pollIntervalSeconds: 30,
  sourceSymbols: [],
  watchlist: [],
  skipped: [],
  message:
    "No tradability samples yet. Click Collect once — async batches of 5 every 30s.",
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

export async function patchTicker(
  symbol: string,
  patch: { active?: boolean; name?: string | null },
): Promise<CatalogTicker> {
  const upper = symbol.trim().toUpperCase();
  if (!upper) {
    throw new Error("Symbol is required.");
  }
  if (patch.active === undefined && patch.name === undefined) {
    throw new Error("Nothing to update.");
  }
  if (USE_MOCK) {
    await delay();
    const index = mockCatalog.findIndex((row) => row.symbol === upper);
    if (index < 0) {
      throw new Error(`Unknown symbol: ${upper}`);
    }
    const nextName =
      patch.name === undefined
        ? mockCatalog[index].name
        : patch.name?.trim()
          ? patch.name.trim()
          : null;
    mockCatalog[index] = {
      ...mockCatalog[index],
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.name !== undefined ? { name: nextName } : {}),
    };
    return { ...mockCatalog[index] };
  }
  const body: Record<string, unknown> = {};
  if (patch.active !== undefined) body.active = patch.active;
  if (patch.name !== undefined) body.name = patch.name?.trim() ? patch.name.trim() : null;
  const payload = await fetchJson<CatalogTicker>(`/tickers/${encodeURIComponent(upper)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return mapTicker(payload);
}

export async function patchTickerActive(symbol: string, active: boolean): Promise<CatalogTicker> {
  return patchTicker(symbol, { active });
}

export async function patchTickerName(symbol: string, name: string | null): Promise<CatalogTicker> {
  return patchTicker(symbol, { name });
}

export async function deleteTicker(symbol: string): Promise<{ symbol: string; deleted: boolean }> {
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
    mockCatalog.splice(index, 1);
    return { symbol: upper, deleted: true };
  }
  return fetchJson<{ symbol: string; deleted: boolean }>(
    `/tickers/${encodeURIComponent(upper)}`,
    { method: "DELETE" },
  );
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
      ranked: [...(mockBestFit.ranked ?? mockBestFit.watchlist)],
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
    const ranked = mockCatalog.map((row, index) => ({
      rank: index + 1,
      symbol: row.symbol,
      name: row.name,
      currentlyActive: row.active,
      score: 80 - index * 1.2,
      tier: index < 2 ? "excellent" : index < 6 ? "strong" : "moderate",
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
    const watchlist = ranked.slice(0, Math.min(limit, ranked.length)).map((row) => ({
      ...row,
      currentlyActive: activateTop ? true : row.currentlyActive,
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
      scoredCount: ranked.length,
      skippedCount: 0,
      watchlist,
      ranked,
      skipped: [],
      activation: activateTop
        ? { applied: true, activated: watchlist.map((w) => w.symbol), deactivated: [] }
        : null,
      message: `Best-fit: ${ranked.length} scored (suggested top ${watchlist.length}) (mock).`,
    };
    return {
      ...mockBestFit,
      watchlist: [...mockBestFit.watchlist],
      ranked: [...(mockBestFit.ranked ?? [])],
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
  batchSize?: number;
}): Promise<TradableWatchlistResponse> {
  const limit = input?.limit ?? 5;
  const activateTop = Boolean(input?.activateTop);
  const force = Boolean(input?.force);
  const batchSize = input?.batchSize ?? input?.maxSamples ?? 5;

  if (USE_MOCK) {
    await delay(300);
    if (!mockCatalog.length) {
      throw new Error("No tickers in the catalog. Add symbols under Watchlist first.");
    }
    const source = mockCatalog.map((row, index) => ({
      symbol: row.symbol,
      name: row.name,
      rank: index + 1,
      score: 70 - index,
    }));
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
    const watchlist = ready.map((row, index) => ({
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
      runId: `tradable-mock-${Date.now()}`,
      status: ready.length >= limit ? "ready" : "collecting",
      resolvedAt: ready.length ? new Date().toISOString() : null,
      collectedAt: new Date().toISOString(),
      limit,
      sourceLimit: source.length,
      sourceCount: source.length,
      minSamplesReady: 8,
      maxSamplesPerRun: 5,
      batchSize: 5,
      batchIntervalSeconds: 30,
      pollIntervalSeconds: 30,
      batchesCompleted: 1,
      readyCount: ready.length,
      scoredCount: watchlist.length,
      skippedCount: 0,
      sourceSymbols: source.map((row) => row.symbol),
      progress,
      sampledThisRun: progress.slice(0, 5).map((row) => ({
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
      message: `Collected samples for full catalog (mock). Ready ${ready.length}/${source.length}.`,
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
      batchSize,
    }),
  });
}

export async function stopTradableCollect(): Promise<{
  runId?: string | null;
  status?: string;
  stopRequested?: boolean;
  message?: string;
}> {
  if (USE_MOCK) {
    await delay(100);
    if (mockTradable) {
      mockTradable = {
        ...mockTradable,
        status: "stopped",
        stopRequested: true,
        message: "Tradable collect stopped (mock).",
      };
    }
    return {
      runId: mockTradable?.runId,
      status: "stopped",
      stopRequested: true,
      message: "Tradable collect stopped (mock).",
    };
  }
  return fetchJson("/tickers/tradable/stop", {
    method: "POST",
    body: "{}",
  });
}

export type TradableResetResponse = {
  kind?: string;
  status?: string;
  profilesDeleted?: number;
  tickersCleared?: number;
  message?: string;
};

/** Wipe all tradability samples + ticker summaries (recollect after zone change). */
export async function resetTradabilitySamples(): Promise<TradableResetResponse> {
  if (USE_MOCK) {
    await delay(150);
    if (mockTradable) {
      mockTradable = {
        ...mockTradable,
        status: "idle",
        readyCount: 0,
        progress: (mockTradable.progress ?? []).map((row) => ({
          ...row,
          sampleCount: 0,
          ready: false,
          typicalBidAskDollars: null,
        })),
        watchlist: [],
        ranked: [],
        message: "Cleared mock tradability samples. Run Collect to resample.",
      };
    }
    return {
      kind: "tradable_watchlist",
      status: "idle",
      profilesDeleted: mockCatalog.length,
      tickersCleared: mockCatalog.length,
      message: "Cleared mock tradability samples. Run Collect to resample.",
    };
  }
  return fetchJson<TradableResetResponse>("/tickers/tradable/reset", {
    method: "POST",
    body: "{}",
  });
}

/** OceanDesk stop_metrics.json — movement stops + tradability bid–ask / $→12%. */
export type OceanDeskMetricsExport = {
  version: number;
  updatedAt: string;
  source: string;
  defaults?: Record<string, unknown>;
  tickers: Record<string, Record<string, unknown>>;
  missing: string[];
  tickerCount: number;
};

export async function postTradableOceanDeskExport(input?: {
  tickers?: string[];
}): Promise<OceanDeskMetricsExport> {
  const tickers = (input?.tickers ?? [])
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  if (USE_MOCK) {
    await delay(200);
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const source = tickers.length
      ? tickers
      : mockCatalog.map((row) => row.symbol.trim().toUpperCase()).filter(Boolean);
    const tickersOut: Record<string, Record<string, unknown>> = {};
    for (const sym of source.slice(0, 5)) {
      tickersOut[sym] = {
        symbol: sym,
        suggestedStopPct: 1.2,
        initialStopLossPercent: 0.072,
        typicalBidAskDollars: 0.15,
        underlyingMoveDollarsForOption12Pct: 1.25,
        tradabilityReady: true,
        tradabilitySampleCount: 8,
      };
    }
    return {
      version: 1,
      updatedAt: now,
      source: "oceanview-movement-profile+tradability",
      tickers: tickersOut,
      missing: source.slice(5),
      tickerCount: Object.keys(tickersOut).length,
    };
  }

  return fetchJson<OceanDeskMetricsExport>("/tickers/tradable/export", {
    method: "POST",
    body: JSON.stringify(tickers.length ? { tickers } : {}),
  });
}
