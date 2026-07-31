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
  /** Single rule (legacy) or omitted when ``ruleKeys`` is set. */
  ruleKey?: AlarmEligibleRuleKey;
  /** Multiple criteria — all required (AND). Candles refreshed once. */
  ruleKeys?: AlarmEligibleRuleKey[];
  trend: AlarmTrend;
  refreshCandles?: boolean;
  /** touch_disipador only — candle + BB TF (default 1m). */
  bandTimeframe?: "1m" | "15m" | "1h";
  /** Optional as-of ET datetime (ISO). When set, uses stored candles. */
  simulationTimeEt?: string;
  /** breakout_quality: confirmed | entry_ready (default entry_ready — alert on Entry only). */
  alarmTarget?: "confirmed" | "entry_ready";
};

export type MarketAlarmCheckResponse = {
  symbol: string;
  ruleKey: string;
  ruleKeys?: string[];
  trend: string;
  detectedTrend?: string | null;
  met: boolean;
  ruleStatus: string;
  ruleResults?: { ruleKey: string; status: string; met?: boolean; evidence?: string | null }[];
  qualityPct?: number;
  evidence?: string | null;
  suggestedTrend?: string | null;
  suggestedDirection?: string | null;
  checkedAt: string;
  simulationTimeEt?: string;
  simulated?: boolean;
  error?: string | null;
  candle?: { symbol?: string; status?: string; error?: string } | null;
  breakoutScore?: number;
  continuationScore?: number;
  rankingScore?: number;
  trendAlignment?: string;
  relativeVolume15m?: number;
  bbExpansion15m?: number;
  adx15m?: number;
  aboveVwap?: boolean;
  breakoutLevel?: number;
  lifecycle?: string;
  breakoutType?: string;
  setupType?: string;
  bandWalk1m?: boolean;
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
    let message =
      typeof record?.error === "string"
        ? record.error
        : typeof record?.message === "string"
          ? record.message
          : `HTTP ${response.status}`;
    const code = typeof record?.code === "string" ? record.code : undefined;
    // API Gateway returns a generic body when Lambda is throttled or the
    // integration hits the ~29s REST timeout — map to something actionable.
    const generic =
      /^internal server error$/i.test(message) ||
      /^endpoint request timed out$/i.test(message) ||
      message === `HTTP ${response.status}`;
    if (generic) {
      if (response.status === 429) {
        message = "Alarm API busy (throttled) — checks are queued; retry shortly.";
      } else if (response.status === 504 || /timed out/i.test(String(record?.message ?? ""))) {
        message = "Alarm check timed out (API Gateway ~29s). Try fewer watches or a longer interval.";
      } else if (response.status >= 500) {
        message =
          "Alarm API overloaded or timed out. Polling continues; reduce concurrent watches if this repeats.";
      }
    }
    throw new MarketAlarmApiError(message, code, response.status);
  }
  return body as T;
}

const mockHits = new Map<string, number>();

export async function postMarketAlarmCheck(
  body: MarketAlarmCheckRequest,
): Promise<MarketAlarmCheckResponse> {
  const symbol = body.symbol.trim().toUpperCase();
  const ruleKeys =
    body.ruleKeys && body.ruleKeys.length > 0
      ? body.ruleKeys
      : body.ruleKey
        ? [body.ruleKey]
        : [];
  const ruleKey = ruleKeys[0] ?? body.ruleKey;
  const trend = body.trend;

  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 350));
    const key = `${symbol}|${ruleKeys.join("+")}|${trend}`;
    const prev = mockHits.get(key) ?? 0;
    const next = prev + 1;
    mockHits.set(key, next);
    const met = next >= 3;
    const side =
      trend === "auto" ? (next % 2 === 0 ? "bajista" : "alcista") : trend === "bajista" ? "bajista" : "alcista";
    return {
      symbol,
      ruleKey: ruleKey ?? "confirmation_change_trend_1h",
      ruleKeys,
      trend,
      detectedTrend: side,
      met,
      ruleStatus: met ? "met" : "not_met",
      ruleResults: ruleKeys.map((rk) => ({
        ruleKey: rk,
        status: met ? "met" : "not_met",
        met,
      })),
      evidence: met
        ? `Mock ${side} confirmation met (${ruleKeys.length} rules)`
        : `Mock waiting (${trend === "auto" ? "auto" : side})`,
      suggestedTrend: side,
      suggestedDirection: side === "alcista" ? "CALL" : "PUT",
      checkedAt: new Date().toISOString(),
      candle: { symbol, status: "ok" },
    };
  }

  return fetchJson<MarketAlarmCheckResponse>("/market/alarm/check", {
    method: "POST",
    body: JSON.stringify({
      symbol,
      ruleKeys,
      ruleKey: ruleKeys[0],
      trend,
      refreshCandles: body.refreshCandles ?? true,
      ...(body.bandTimeframe ? { bandTimeframe: body.bandTimeframe } : {}),
      ...(body.simulationTimeEt ? { simulationTimeEt: body.simulationTimeEt } : {}),
      ...(body.alarmTarget ? { alarmTarget: body.alarmTarget } : {}),
    }),
  });
}
