import { apiFetch, getApiBaseUrl, readResponseBody } from "@/shared/api/api-fetch";

const API_BASE = getApiBaseUrl();
const USE_MOCK = import.meta.env.VITE_USE_MOCK_PREMARKET === "true";

export class PremarketAlarmApiError extends Error {
  readonly code: string | undefined;
  readonly status: number | undefined;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = "PremarketAlarmApiError";
    this.code = code;
    this.status = status;
  }
}

export type PremarketAlarmCheckRequest = {
  symbol: string;
  strategyId: string;
  refreshCandles?: boolean;
  signalThresholdPct?: number;
};

export type PremarketAlarmCheckResponse = {
  symbol: string;
  strategyId: string;
  qualityPct: number;
  signalThresholdPct: number;
  met: boolean;
  checkedAt: string;
  simulationTimeEt?: string;
  direction?: string | null;
  error?: string | null;
  candle?: { symbol?: string; status?: string; error?: string } | null;
};

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new PremarketAlarmApiError("VITE_API_BASE_URL is not set.");
  }
  const response = await apiFetch(path, init);
  const body = await readResponseBody(response);
  if (!response.ok) {
    const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
    const message =
      typeof record?.error === "string"
        ? record.error
        : typeof record?.message === "string"
          ? record.message
          : `HTTP ${response.status}`;
    const code = typeof record?.code === "string" ? record.code : undefined;
    throw new PremarketAlarmApiError(message, code, response.status);
  }
  return body as T;
}

const mockQuality = new Map<string, number>();

export async function postPremarketAlarmCheck(
  body: PremarketAlarmCheckRequest,
): Promise<PremarketAlarmCheckResponse> {
  const symbol = body.symbol.trim().toUpperCase();
  const strategyId = body.strategyId.trim();
  const threshold = body.signalThresholdPct ?? 50;

  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 350));
    const key = `${symbol}|${strategyId}`;
    const prev = mockQuality.get(key) ?? 20;
    const next = Math.min(100, prev + 15 + Math.floor(Math.random() * 10));
    mockQuality.set(key, next);
    return {
      symbol,
      strategyId,
      qualityPct: next,
      signalThresholdPct: threshold,
      met: next >= threshold,
      checkedAt: new Date().toISOString(),
      direction: "CALL",
      candle: { symbol, status: "ok" },
    };
  }

  return fetchJson<PremarketAlarmCheckResponse>("/premarket/alarm/check", {
    method: "POST",
    body: JSON.stringify({
      symbol,
      strategyId,
      refreshCandles: body.refreshCandles ?? true,
      signalThresholdPct: threshold,
    }),
  });
}
