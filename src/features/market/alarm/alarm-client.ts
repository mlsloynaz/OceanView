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
  /** Outside RTH — keep polling; resume automatically at next open. */
  paused?: boolean;
  marketOpen?: boolean | null;
  message?: string | null;
  nextOpenEt?: string | null;
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
  overextended?: boolean;
  lateEntry?: boolean;
  continuationMomentumScore?: number;
  continuationEntryScore?: number;
  entryBlockers?: string[];
  entryPath?: string | null;
  acceptanceScore?: number;
  impulseScore?: number;
  holdScore?: number;
  reasons?: string[];
  warnings?: string[];
  bbSparkline15m?: {
    symbol: string;
    timeframe: "15m";
    bbPeriod: number;
    bars: Array<{
      datetime: string;
      open: number;
      high: number;
      low: number;
      close: number;
      bbUpper: number | null;
      bbMid: number | null;
      bbLower: number | null;
      bbWidth?: number | null;
      upperExpanding?: boolean | null;
      lowerExpanding?: boolean | null;
      widthExpanding?: boolean | null;
      forming?: boolean;
    }>;
  } | null;
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

export type MarketAlarmScanLastHourRequest = {
  symbol: string;
  ruleKey?: AlarmEligibleRuleKey;
  ruleKeys?: AlarmEligibleRuleKey[];
  trend?: AlarmTrend;
  bandTimeframe?: "1m" | "15m" | "1h";
  stepMinutes?: 1 | 5 | 15;
  /** Anchor for “last completed RTH hour” (ISO). Default = now. */
  asOfEt?: string;
  refreshCandles?: boolean;
};

export type MarketAlarmScanStep = {
  simulationTimeEt: string;
  clockEt: string;
  lifecycle?: string | null;
  confirmed: boolean;
  entry: boolean;
  met?: boolean;
  suggestedDirection?: string | null;
  suggestedTrend?: string | null;
  breakoutScore?: number | null;
  continuationScore?: number | null;
  qualityPct?: number | null;
  evidence?: string | null;
  entryPath?: string | null;
};

export type MarketAlarmScanLastHourResponse = {
  symbol: string;
  windowStartEt: string;
  windowEndEt: string;
  stepMinutes: number;
  asOfEt: string;
  firstConfirmedAt: string | null;
  firstEntryAt: string | null;
  summary: string;
  steps: MarketAlarmScanStep[];
};

export async function postMarketAlarmScanLastHour(
  body: MarketAlarmScanLastHourRequest,
): Promise<MarketAlarmScanLastHourResponse> {
  const symbol = body.symbol.trim().toUpperCase();
  const ruleKeys =
    body.ruleKeys && body.ruleKeys.length > 0
      ? body.ruleKeys
      : body.ruleKey
        ? [body.ruleKey]
        : ["breakout_quality"];

  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400));
    const base = new Date();
    base.setMinutes(0, 0, 0);
    const steps: MarketAlarmScanStep[] = [15, 30, 45, 60].map((m, i) => {
      const t = new Date(base.getTime() - 60 * 60_000 + m * 60_000);
      const confirmed = i >= 1;
      const entry = i >= 3;
      return {
        simulationTimeEt: t.toISOString(),
        clockEt: t.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "America/New_York",
        }),
        lifecycle: entry ? "entry_ready" : confirmed ? "awaiting_entry" : "setup_forming",
        confirmed,
        entry,
        met: entry,
        suggestedDirection: "CALL",
        suggestedTrend: "alcista",
        breakoutScore: confirmed ? 82 : 40,
        continuationScore: entry ? 70 : 45,
        evidence: entry ? "mock entry" : confirmed ? "mock confirmed" : "mock setup",
      };
    });
    return {
      symbol,
      windowStartEt: steps[0]!.simulationTimeEt,
      windowEndEt: steps[3]!.simulationTimeEt,
      stepMinutes: 15,
      asOfEt: new Date().toISOString(),
      firstConfirmedAt: steps[1]!.simulationTimeEt,
      firstEntryAt: steps[3]!.simulationTimeEt,
      summary: "mock · Confirmed · Entry",
      steps,
    };
  }

  return fetchJson<MarketAlarmScanLastHourResponse>("/market/alarm/scan-last-hour", {
    method: "POST",
    body: JSON.stringify({
      symbol,
      ruleKeys,
      ruleKey: ruleKeys[0],
      trend: body.trend ?? "auto",
      stepMinutes: body.stepMinutes ?? 15,
      refreshCandles: body.refreshCandles ?? false,
      ...(body.bandTimeframe ? { bandTimeframe: body.bandTimeframe } : {}),
      ...(body.asOfEt ? { asOfEt: body.asOfEt } : {}),
    }),
  });
}
