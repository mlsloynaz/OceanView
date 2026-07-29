import { apiFetch, getApiBaseUrl, readResponseBody } from "@/shared/api/api-fetch";
import type { AlarmEligibleRuleKey, AlarmTrend } from "./alarm-types";

const API_BASE = getApiBaseUrl();
const USE_MOCK = import.meta.env.VITE_USE_MOCK_MARKET === "true";

export class MarketAlarmApiError extends Error {
  readonly code: string | undefined;
  readonly status: number | undefined;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = "MarketAlarmApiError";
    this.code = code;
    this.status = status;
  }
}

export type MarketAlarmCheckRequest = {
  symbol: string;
  ruleKey: AlarmEligibleRuleKey;
  trend: AlarmTrend;
  refreshCandles?: boolean;
  /** touch_disipador only — candle + BB TF (default 1m). */
  bandTimeframe?: "1m" | "15m" | "1h";
};

export type MarketAlarmCheckResponse = {
  symbol: string;
  ruleKey: string;
  trend: string;
  met: boolean;
  ruleStatus: string;
  qualityPct?: number;
  evidence?: string | null;
  suggestedTrend?: string | null;
  suggestedDirection?: string | null;
  checkedAt: string;
  simulationTimeEt?: string;
  error?: string | null;
  candle?: { symbol?: string; status?: string; error?: string } | null;
  /** Present when ruleKey is breakout_quality. */
  breakoutScore?: number;
  continuationScore?: number;
  trendAlignment?: string;
  relativeVolume15m?: number;
  bbExpansion15m?: number;
  adx15m?: number;
  aboveVwap?: boolean;
  breakoutLevel?: number;
  lifecycle?: string;
  reasons?: string[];
  warnings?: string[];
};

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new MarketAlarmApiError("VITE_API_BASE_URL is not set.");
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
    throw new MarketAlarmApiError(message, code, response.status);
  }
  return body as T;
}

const mockHits = new Map<string, number>();

export async function postMarketAlarmCheck(
  body: MarketAlarmCheckRequest,
): Promise<MarketAlarmCheckResponse> {
  const symbol = body.symbol.trim().toUpperCase();
  const ruleKey = body.ruleKey;
  const trend = body.trend;

  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 350));
    const key = `${symbol}|${ruleKey}|${trend}`;
    const prev = mockHits.get(key) ?? 0;
    const next = prev + 1;
    mockHits.set(key, next);
    const met = next >= 3;
    return {
      symbol,
      ruleKey,
      trend,
      met,
      ruleStatus: met ? "met" : "not_met",
      evidence: met ? `Mock ${trend} confirmation met` : "Mock waiting for confirmation",
      suggestedTrend: trend,
      suggestedDirection: trend === "alcista" ? "CALL" : "PUT",
      checkedAt: new Date().toISOString(),
      candle: { symbol, status: "ok" },
    };
  }

  return fetchJson<MarketAlarmCheckResponse>("/market/alarm/check", {
    method: "POST",
    body: JSON.stringify({
      symbol,
      ruleKey,
      trend,
      refreshCandles: body.refreshCandles ?? true,
      ...(body.bandTimeframe ? { bandTimeframe: body.bandTimeframe } : {}),
    }),
  });
}
