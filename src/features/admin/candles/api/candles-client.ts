import {
  buildMockResult,
  buildMockStatus,
  completeMockJob,
  markMockJobStarted,
  MOCK_CATALOG,
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

const MOCK_DELAY_MS = 280;

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "/api";
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

function mapTicker(row: AdminTicker & { active?: boolean }): AdminTicker | null {
  if (row.active === false) return null;
  return {
    symbol: row.symbol,
    name: row.name ?? null,
    isFavorite: Boolean(row.isFavorite),
  };
}

export function candlesApiUsesMock(): boolean {
  return USE_MOCK;
}

export function candlesApiBaseUrl(): string | null {
  return API_BASE || null;
}

export async function getAdminTickers(): Promise<AdminTickersResponse> {
  if (USE_MOCK) {
    await delay();
    return { tickers: MOCK_CATALOG };
  }
  const payload = await fetchJson<{ tickers: (AdminTicker & { active?: boolean })[] }>("/tickers");
  const tickers = (payload.tickers ?? [])
    .map(mapTicker)
    .filter((row): row is AdminTicker => row !== null);
  return { tickers };
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
