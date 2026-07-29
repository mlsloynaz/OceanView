import { getTickersCatalog } from "../../tickers/api/tickers-client";
import {
  buildMockResult,
  buildMockStatus,
  completeMockJob,
  markMockJobStarted,
} from "./mock-data";
import type {
  AdminTicker,
  AdminTickersResponse,
  CandlesBanner,
  CandlesJob,
  CandlesJobAckResponse,
  CandlesRequest,
  CandlesResultResponse,
  CandlesStatusResponse,
  JobKind,
  JobStatus,
  SymbolCandleRow,
} from "../types";
import { apiFetch, getApiBaseUrl, readResponseBody } from "@/shared/api/api-fetch";

const MOCK_DELAY_MS = 280;

const API_BASE = getApiBaseUrl();
const USE_MOCK = import.meta.env.VITE_USE_MOCK_CANDLES === "true";

function delay(ms = MOCK_DELAY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTickers(tickers: string[]): string[] {
  return [...new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))];
}

type ApiProgress = { done?: number; completed?: number; total: number };

type ApiLastRun = {
  runId?: string;
  jobId?: string;
  kind?: JobKind;
  status?: JobStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
  summary?: CandlesJob["summary"];
  progress?: ApiProgress;
};

type ApiResultPayload = {
  lastRun?: ApiLastRun | null;
  job?: ApiLastRun | null;
  banner: CandlesBanner;
  symbols: SymbolCandleRow[];
};

type ApiStatusPayload = {
  lastRun?: ApiLastRun | null;
  job?: ApiLastRun | null;
  symbols: SymbolCandleRow[];
};

type ApiAckPayload = {
  runId?: string;
  jobId?: string;
  kind: JobKind;
  status: JobStatus;
  message: string;
  tickers: string[];
  summary?: CandlesJob["summary"];
};

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new Error("VITE_API_BASE_URL is not set.");
  }
  const response = await apiFetch(path, init);
  const body = await readResponseBody(response);
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

function mapProgress(progress: ApiProgress | undefined): CandlesJob["progress"] | undefined {
  if (!progress) return undefined;
  const completed = progress.completed ?? progress.done ?? 0;
  return { completed, total: progress.total };
}

function mapLastRun(raw: ApiLastRun | null | undefined): CandlesJob | null {
  if (!raw) return null;
  const jobId = raw.jobId ?? raw.runId ?? "";
  if (!jobId && raw.status === "idle") {
    return {
      jobId: "",
      kind: raw.kind ?? "refresh",
      status: "idle",
      startedAt: null,
      finishedAt: null,
    };
  }
  return {
    jobId,
    kind: raw.kind ?? "refresh",
    status: raw.status ?? "idle",
    startedAt: raw.startedAt ?? null,
    finishedAt: raw.finishedAt ?? null,
    summary: raw.summary,
    progress: mapProgress(raw.progress),
  };
}

function mapResultPayload(payload: ApiResultPayload): CandlesResultResponse {
  const run = payload.lastRun ?? payload.job ?? null;
  return {
    job: mapLastRun(run),
    banner: payload.banner,
    symbols: payload.symbols,
  };
}

function mapStatusPayload(payload: ApiStatusPayload): CandlesStatusResponse {
  const run = payload.lastRun ?? payload.job ?? null;
  return {
    job: mapLastRun(run),
    symbols: payload.symbols,
  };
}

function mapAckPayload(payload: ApiAckPayload): CandlesJobAckResponse {
  return {
    jobId: payload.jobId ?? payload.runId ?? "",
    kind: payload.kind,
    status: payload.status,
    message: payload.message,
    tickers: payload.tickers,
    summary: payload.summary,
  };
}

function mapActiveTicker(row: AdminTicker & { active?: boolean }): AdminTicker {
  return {
    symbol: row.symbol,
    name: row.name ?? null,
    isFavorite: Boolean(row.isFavorite),
    active: row.active !== false,
  };
}

export async function getAdminTickers(): Promise<AdminTickersResponse> {
  if (USE_MOCK) {
    await delay();
    const { tickers } = await getTickersCatalog();
    return { tickers: tickers.map(mapActiveTicker) };
  }
  const payload = await fetchJson<{ tickers: (AdminTicker & { active?: boolean })[] }>("/tickers");
  return { tickers: (payload.tickers ?? []).map(mapActiveTicker) };
}

export function candlesApiUsesMock(): boolean {
  return USE_MOCK;
}

export function candlesApiBaseUrl(): string | null {
  return API_BASE || null;
}

export async function postCandlesResult(body: CandlesRequest): Promise<CandlesResultResponse> {
  const tickers = normalizeTickers(body.tickers);
  if (USE_MOCK) {
    await delay();
    return buildMockResult(tickers);
  }
  const payload = await fetchJson<ApiResultPayload>("/candles/result", {
    method: "POST",
    body: JSON.stringify({ tickers }),
  });
  return mapResultPayload(payload);
}

export async function postCandlesStatus(body: CandlesRequest): Promise<CandlesStatusResponse> {
  const tickers = normalizeTickers(body.tickers);
  if (USE_MOCK) {
    await delay();
    const status = buildMockStatus(tickers);
    if (status.job?.status !== "running") {
      completeMockJob();
    }
    return status;
  }
  const payload = await fetchJson<ApiStatusPayload>("/candles/status", {
    method: "POST",
    body: JSON.stringify({ tickers }),
  });
  return mapStatusPayload(payload);
}

export async function postCandlesRefresh(body: CandlesRequest): Promise<CandlesJobAckResponse> {
  const tickers = normalizeTickers(body.tickers);
  if (tickers.length === 0) {
    throw new Error("At least one ticker is required.");
  }
  if (USE_MOCK) {
    await delay();
    markMockJobStarted("refresh");
    return {
      jobId: `candles-mock-${Date.now()}`,
      kind: "refresh",
      status: "running",
      message: "Candle refresh started. Use Refresh status when ready.",
      tickers,
    };
  }
  const payload = await fetchJson<ApiAckPayload>("/candles/refresh", {
    method: "POST",
    body: JSON.stringify({ tickers }),
  });
  return mapAckPayload(payload);
}

export async function postCandlesReset(body: CandlesRequest): Promise<CandlesJobAckResponse> {
  const tickers = normalizeTickers(body.tickers);
  if (tickers.length === 0) {
    throw new Error("At least one ticker is required.");
  }
  if (USE_MOCK) {
    await delay();
    markMockJobStarted("reset");
    return {
      jobId: `candles-mock-${Date.now()}`,
      kind: "reset",
      status: "running",
      message: "Candle reset started. Use Refresh status when ready.",
      tickers,
    };
  }
  const payload = await fetchJson<ApiAckPayload>("/candles/reset", {
    method: "POST",
    body: JSON.stringify({ tickers }),
  });
  return mapAckPayload(payload);
}

export async function postMovementProfilesBuild(
  body: CandlesRequest & { batchSize?: number },
): Promise<CandlesJobAckResponse> {
  const tickers = normalizeTickers(body.tickers);
  if (tickers.length === 0) {
    throw new Error("At least one ticker is required.");
  }
  const batchSize = body.batchSize ?? 5;
  if (USE_MOCK) {
    await delay(400);
    return {
      jobId: `mvprof-mock-${Date.now()}`,
      kind: "build_movement_profiles",
      status: "running",
      message:
        "Movement profile build started (mock). Check Job Status — batches of 5, ~1y hourly in memory.",
      tickers,
    };
  }
  const payload = await fetchJson<ApiAckPayload>("/candles/movement-profiles/build", {
    method: "POST",
    body: JSON.stringify({ tickers, batchSize }),
  });
  return mapAckPayload(payload);
}

export async function postMovementProfilesStop(): Promise<{
  runId?: string;
  status: string;
  stopRequested?: boolean;
  message?: string;
}> {
  if (USE_MOCK) {
    await delay();
    return {
      runId: "mvprof-mock",
      status: "stopping",
      stopRequested: true,
      message: "Stop requested (mock).",
    };
  }
  return fetchJson("/candles/movement-profiles/stop", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/** OceanDesk stop_metrics.json payload from stored movement profiles. */
export type StopMetricsExport = {
  version: number;
  updatedAt: string;
  source: string;
  defaults: {
    initialStopLossPercent: number;
    refStockStopPct: number;
    minInitialStopLossPercent: number;
    maxInitialStopLossPercent: number;
  };
  tickers: Record<string, Record<string, unknown>>;
  missing: string[];
  tickerCount: number;
};

export async function postMovementProfilesStopMetrics(body: {
  tickers: string[];
}): Promise<StopMetricsExport> {
  const tickers = body.tickers.map((t) => t.trim().toUpperCase()).filter(Boolean);
  if (USE_MOCK) {
    await delay(200);
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const tickersOut: Record<string, Record<string, unknown>> = {};
    for (const sym of tickers.slice(0, 3)) {
      tickersOut[sym] = {
        symbol: sym,
        suggestedStopPct: 1.2,
        expectedMaePct: 0.9,
        pullbackPct: 0.8,
        winRate: 0.6,
        atrPct: 0.55,
        initialStopLossPercent: 0.072,
        sampleSize: 10,
        timeframe: "1h",
        asOf: now,
      };
    }
    return {
      version: 1,
      updatedAt: now,
      source: "oceanview-movement-profile",
      defaults: {
        initialStopLossPercent: 0.06,
        refStockStopPct: 1.0,
        minInitialStopLossPercent: 0.04,
        maxInitialStopLossPercent: 0.2,
      },
      tickers: tickersOut,
      missing: tickers.filter((s) => !(s in tickersOut)),
      tickerCount: Object.keys(tickersOut).length,
    };
  }
  return fetchJson<StopMetricsExport>("/candles/movement-profiles/stop-metrics", {
    method: "POST",
    body: JSON.stringify({ tickers }),
  });
}
