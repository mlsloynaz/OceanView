import type {
  MarketEnvelope,
  MarketEvaluateRequest,
  MarketEvaluateResponse,
  MarketEvaluateStatusResponse,
  RuleSnapshotItem,
  StrategiesCatalogFile,
  StrategyDetailResponse,
  StrategySnapshotItem,
  TickerDetailResponse,
  TickerSnapshotItem,
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "/api";
const USE_MOCK = import.meta.env.VITE_USE_MOCK_MARKET === "true";

export class MarketApiError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "MarketApiError";
    this.code = code;
  }
}

export const MARKET_ERROR_MESSAGES: Record<string, string> = {
  MARKET_EVAL_OUT_OF_COVERAGE:
    "Assessment time is outside available candle history. Refresh candles in Admin, then try again.",
  MARKET_EVAL_CONFLICT: "Another assessment is already running.",
  MARKET_NO_CANDLES: "No candle data — refresh candles in Admin.",
  MARKET_INVALID_SYMBOL: "Invalid symbol or empty ticker catalog.",
};

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new MarketApiError("VITE_API_BASE_URL is not set.");
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
    const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
    const message =
      typeof record?.error === "string"
        ? record.error
        : typeof record?.message === "string"
          ? record.message
          : `HTTP ${response.status}`;
    const code = typeof record?.code === "string" ? record.code : undefined;
    throw new MarketApiError(message, code);
  }
  return body as T;
}

function withRunId(path: string, runId?: string | null): string {
  if (!runId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}runId=${encodeURIComponent(runId)}`;
}

export function marketDataUsesMock(): boolean {
  return USE_MOCK;
}

export function marketApiBaseUrl(): string | null {
  return API_BASE || null;
}

export async function fetchMarketEnvelope(): Promise<MarketEnvelope> {
  return fetchJson<MarketEnvelope>("/market/envelope");
}

export async function fetchStrategiesCatalog(): Promise<StrategiesCatalogFile> {
  return fetchJson<StrategiesCatalogFile>("/market/strategies");
}

export async function fetchStrategiesSnapshot(runId?: string | null) {
  return fetchJson<{ runId: string; items: StrategySnapshotItem[] }>(
    withRunId("/market/strategies/snapshot", runId),
  );
}

export async function fetchTickersSnapshot(runId?: string | null) {
  return fetchJson<{ runId: string; items: TickerSnapshotItem[] }>(
    withRunId("/market/tickers/snapshot", runId),
  );
}

export async function fetchRulesSnapshot(runId?: string | null) {
  return fetchJson<{ runId: string; items: RuleSnapshotItem[] }>(
    withRunId("/market/rules/snapshot", runId),
  );
}

export async function fetchStrategyDetail(
  strategyId: string,
  runId?: string | null,
): Promise<StrategyDetailResponse> {
  return fetchJson<StrategyDetailResponse>(
    withRunId(`/market/strategies/${encodeURIComponent(strategyId)}/detail`, runId),
  );
}

export async function fetchTickerDetail(
  symbol: string,
  runId?: string | null,
): Promise<TickerDetailResponse> {
  return fetchJson<TickerDetailResponse>(
    withRunId(`/market/tickers/${encodeURIComponent(symbol.toUpperCase())}/detail`, runId),
  );
}

export async function postMarketEvaluate(
  body: MarketEvaluateRequest,
): Promise<MarketEvaluateResponse> {
  return fetchJson<MarketEvaluateResponse>("/market/evaluate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_DURATION_MS = 10_000;

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isAssessUsable(status: string | undefined): boolean {
  const value = (status ?? "").toLowerCase();
  return value === "ready" || value === "complete" || value === "partial";
}

function isAssessTerminal(status: string | undefined): boolean {
  const value = (status ?? "").toLowerCase();
  return value === "complete" || value === "partial" || value === "failed";
}

/** Poll up to 10s after start — does not throw on timeout. */
export async function pollMarketEvaluate(
  runId: string,
  onProgress?: (payload: MarketEvaluateStatusResponse) => void,
): Promise<MarketEvaluateStatusResponse | null> {
  const deadline = Date.now() + POLL_MAX_DURATION_MS;
  let last: MarketEvaluateStatusResponse | null = null;
  while (Date.now() < deadline) {
    last = await fetchEvaluateStatus(runId);
    onProgress?.(last);
    if (isAssessUsable(last.status) && isAssessTerminal(last.status)) {
      return last;
    }
    if (Date.now() + POLL_INTERVAL_MS >= deadline) {
      break;
    }
    await delay(POLL_INTERVAL_MS);
  }
  return last;
}

export async function fetchEvaluateStatus(
  runId: string,
): Promise<MarketEvaluateStatusResponse> {
  return fetchJson<MarketEvaluateStatusResponse>(
    `/market/evaluate/${encodeURIComponent(runId)}`,
  );
}
