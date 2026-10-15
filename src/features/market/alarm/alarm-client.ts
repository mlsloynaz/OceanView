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
  entryAt?: string | null;
  possibleOptionGainPct?: number | null;
  suggestedTrend?: string | null;
  suggestedDirection?: string | null;
  checkedAt: string;
  simulationTimeEt?: string;
  simulated?: boolean;
  error?: string | null;
  candle?: { symbol?: string; status?: string; error?: string } | null;
  /** Outside RTH — keep polling; resume automatically at next open. */
  paused?: boolean;
  /** Confirmación E03 after 9:45 ET — client should drop the watch. */
  expired?: boolean;
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
  hourRegime?: string | null;
  hourRelation?: string | null;
  hourGateBlocked?: boolean;
  bandWalk1m?: boolean;
  overextended?: boolean;
  lateEntry?: boolean;
  continuationMomentumScore?: number;
  continuationEntryScore?: number;
  entryBlockers?: string[];
  entryPath?: string | null;
  entryEvent?: boolean | null;
  movementState?: string | null;
  triggerType?: string | null;
  shadowEarly?: {
    entryPath?: string | null;
    movementState?: string | null;
    triggerType?: string | null;
    entryEvent?: boolean | null;
    qualifies?: boolean | null;
    confirmedOptionGainPct?: number | null;
    earlyOptionGainPct?: number | null;
    confirmedRoomOk?: boolean | null;
    earlyRoomOk?: boolean | null;
  } | null;
  roomByPath?: {
    confirmed_5m?: { optionGainPct?: number | null; roomOk?: boolean | null } | null;
    early?: { optionGainPct?: number | null; roomOk?: boolean | null } | null;
  } | null;
  acceptanceScore?: number;
  impulseScore?: number;
  holdScore?: number;
  reasons?: string[];
  warnings?: string[];
  brokenNow?: boolean;
  entryOk?: boolean;
  countertrend?: boolean;
  trend1h?: string;
  grade?: string;
  last?: number;
  movementChart?: {
    symbol: string;
    timeframe: "5m" | "15m";
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
      ema10?: number | null;
      ema21?: number | null;
      forming?: boolean;
    }>;
  } | null;
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

export type MarketAlarmTriggerEntry = {
  id: string;
  watchId: string;
  symbol: string;
  kind: "enter" | "exit";
  triggeredAt: string;
  way: string;
  ruleLabel: string;
  ruleKeys: string[];
  side: string;
  evidence: string | null;
  tradeDate?: string;
  /** Non-top ENTER pool ref (optional; may be stored in way if API strips fields). */
  topRatedSymbol?: string;
  topRatedEarningPct?: number | null;
};

export type MarketAlarmTriggersListResponse = {
  entries: MarketAlarmTriggerEntry[];
  count: number;
  updatedAt?: string | null;
  tradeDate?: string | null;
  weekStart?: string | null;
  scope?: "week" | "recent";
};

const mockTriggerStore: MarketAlarmTriggerEntry[] = [];

export async function fetchMarketAlarmTriggers(
  week?: string,
): Promise<MarketAlarmTriggersListResponse> {
  if (USE_MOCK) {
    return { entries: [...mockTriggerStore], count: mockTriggerStore.length };
  }
  const query = week ? `?week=${encodeURIComponent(week)}` : "";
  return fetchJson<MarketAlarmTriggersListResponse>(`/market/alarm/triggers${query}`, {
    method: "GET",
  });
}

export async function postMarketAlarmTrigger(
  entry: Omit<MarketAlarmTriggerEntry, "id"> & { id?: string },
): Promise<{ entry: MarketAlarmTriggerEntry; count: number }> {
  if (USE_MOCK) {
    const row: MarketAlarmTriggerEntry = {
      id: entry.id || `trig-mock-${Date.now()}`,
      watchId: entry.watchId,
      symbol: entry.symbol,
      kind: entry.kind,
      triggeredAt: entry.triggeredAt,
      way: entry.way,
      ruleLabel: entry.ruleLabel,
      ruleKeys: entry.ruleKeys,
      side: entry.side,
      evidence: entry.evidence,
      tradeDate: entry.tradeDate,
      ...(entry.topRatedSymbol
        ? {
            topRatedSymbol: entry.topRatedSymbol,
            topRatedEarningPct: entry.topRatedEarningPct ?? null,
          }
        : {}),
    };
    mockTriggerStore.unshift(row);
    if (mockTriggerStore.length > 120) mockTriggerStore.length = 120;
    return { entry: row, count: mockTriggerStore.length };
  }
  return fetchJson<{ entry: MarketAlarmTriggerEntry; count: number }>(
    "/market/alarm/triggers",
    {
      method: "POST",
      body: JSON.stringify(entry),
    },
  );
}

export async function deleteMarketAlarmTriggers(): Promise<{ ok: boolean; count: number }> {
  if (USE_MOCK) {
    mockTriggerStore.length = 0;
    return { ok: true, count: 0 };
  }
  return fetchJson<{ ok: boolean; count: number }>("/market/alarm/triggers", {
    method: "DELETE",
  });
}

export type OrbAutoJobStatus = {
  jobType: string;
  kind: string;
  status: "idle" | "running" | "cancelled" | "completed" | string;
  symbols: string[];
  tradeDate?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  cancelledAt?: string | null;
  message?: string | null;
  windowOpen?: boolean;
  windowMessage?: string | null;
  defaultSymbols?: string[];
  pollIntervalSeconds?: number;
};

export async function fetchOrbAutoJobStatus(): Promise<OrbAutoJobStatus> {
  if (USE_MOCK) {
    return {
      jobType: "orb_auto_monitor",
      kind: "orb_auto_monitor",
      status: "idle",
      symbols: ["TSLA", "MSFT", "SPY"],
      windowOpen: true,
      pollIntervalSeconds: 45,
      message: "ORB auto idle (mock).",
    };
  }
  return fetchJson<OrbAutoJobStatus>("/market/alarm/orb-auto/status", { method: "GET" });
}

export async function startOrbAutoJob(body?: {
  symbols?: string[];
  trigger?: string;
}): Promise<OrbAutoJobStatus> {
  if (USE_MOCK) {
    return {
      jobType: "orb_auto_monitor",
      kind: "orb_auto_monitor",
      status: "running",
      symbols: body?.symbols?.length ? body.symbols : ["TSLA", "MSFT", "SPY"],
      windowOpen: true,
      pollIntervalSeconds: 45,
      message: "ORB auto running — TSLA, MSFT, SPY (mock).",
    };
  }
  return fetchJson<OrbAutoJobStatus>("/market/alarm/orb-auto/start", {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export async function stopOrbAutoJob(
  reason: "cancelled" | "completed" = "cancelled",
): Promise<OrbAutoJobStatus> {
  if (USE_MOCK) {
    return {
      jobType: "orb_auto_monitor",
      kind: "orb_auto_monitor",
      status: reason === "completed" ? "completed" : "cancelled",
      symbols: ["TSLA", "MSFT", "SPY"],
      windowOpen: false,
      pollIntervalSeconds: 45,
      message:
        reason === "completed"
          ? "ORB window ended — auto job completed."
          : "ORB auto cancelled — use manual ticker selection.",
    };
  }
  return fetchJson<OrbAutoJobStatus>("/market/alarm/orb-auto/stop", {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export type MovementWatchJobStatus = {
  jobType: "movement_watch" | string;
  kind?: string;
  title?: string;
  status: "idle" | "running" | "cancelled" | "completed" | string;
  symbols: string[];
  ruleKeys: string[];
  tradeDate?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  cancelledAt?: string | null;
  message?: string | null;
  jobActive?: boolean;
  canStart?: boolean;
  canStop?: boolean;
  pollIntervalSeconds?: number;
  activeTickerCount?: number;
};

export type ActiveMovementsPayload = {
  jobType: "active_movements" | string;
  ruleKeys: string[];
  labels?: Record<string, string>;
  eligibleRuleKeys?: string[];
  updatedAt?: string | null;
  /** Optional filter for confirmed 5m and 15m entries. Off records them instead of blocking. */
  hourRegimeBlock?: boolean;
  /** Early 5m continuation and reversal always block a strong opposite 1h. */
  earlyEntryStrongHourBlock?: boolean;
  hourRegimeBlockNote?: string;
};

export async function fetchMovementWatchJobStatus(): Promise<MovementWatchJobStatus> {
  if (USE_MOCK) {
    return {
      jobType: "movement_watch",
      kind: "movement_watch",
      title: "Movement Watch",
      status: "idle",
      symbols: [],
      ruleKeys: ["trend_change_5m", "trend_change_15m", "ema_cross_5m"],
      pollIntervalSeconds: 60,
      canStart: true,
      canStop: false,
      message: "Movement Watch idle (mock).",
    };
  }
  return fetchJson<MovementWatchJobStatus>("/market/alarm/movement-watch/status", {
    method: "GET",
  });
}

export async function startMovementWatchJob(body?: {
  symbols?: string[];
  ruleKeys?: string[];
  trigger?: string;
}): Promise<MovementWatchJobStatus> {
  if (USE_MOCK) {
    return {
      jobType: "movement_watch",
      kind: "movement_watch",
      title: "Movement Watch",
      status: "running",
      symbols: body?.symbols ?? ["AAPL"],
      ruleKeys: body?.ruleKeys ?? ["trend_change_5m"],
      pollIntervalSeconds: 60,
      canStart: false,
      canStop: true,
      jobActive: true,
      message: "Movement Watch running (mock).",
    };
  }
  return fetchJson<MovementWatchJobStatus>("/market/alarm/movement-watch/start", {
    method: "POST",
    body: JSON.stringify(body ?? { trigger: "manual" }),
  });
}

export async function stopMovementWatchJob(
  reason: "cancelled" | "completed" = "cancelled",
): Promise<MovementWatchJobStatus> {
  if (USE_MOCK) {
    return {
      jobType: "movement_watch",
      kind: "movement_watch",
      title: "Movement Watch",
      status: reason === "completed" ? "completed" : "cancelled",
      symbols: [],
      ruleKeys: [],
      pollIntervalSeconds: 60,
      canStart: reason !== "cancelled",
      canStop: false,
      message:
        reason === "completed"
          ? "Movement Watch completed."
          : "Movement Watch cancelled — start again from Admin.",
    };
  }
  return fetchJson<MovementWatchJobStatus>("/market/alarm/movement-watch/stop", {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function fetchActiveMovements(): Promise<ActiveMovementsPayload> {
  if (USE_MOCK) {
    return {
      jobType: "active_movements",
      ruleKeys: ["trend_change_5m", "trend_change_15m", "ema_cross_5m"],
      eligibleRuleKeys: ["trend_change_5m", "trend_change_15m", "ema_cross_5m"],
      labels: {
        trend_change_5m: "5m trend change",
        trend_change_15m: "15m trend change",
        ema_cross_5m: "EMA cross 5m",
      },
    };
  }
  return fetchJson<ActiveMovementsPayload>("/market/alarm/active-movements", {
    method: "GET",
  });
}

export async function putActiveMovements(
  ruleKeys: string[],
  hourRegimeBlock?: boolean,
): Promise<ActiveMovementsPayload> {
  if (USE_MOCK) {
    return {
      jobType: "active_movements",
      ruleKeys,
      hourRegimeBlock: Boolean(hourRegimeBlock),
      eligibleRuleKeys: ["trend_change_5m", "trend_change_15m", "ema_cross_5m"],
    };
  }
  const body: { ruleKeys: string[]; hourRegimeBlock?: boolean } = { ruleKeys };
  if (hourRegimeBlock !== undefined) body.hourRegimeBlock = hourRegimeBlock;
  return fetchJson<ActiveMovementsPayload>("/market/alarm/active-movements", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/** @deprecated Use fetchMovementWatchJobStatus — orb-5m-auto aliases Movement Watch. */
export async function fetchOrb5mAutoJobStatus(): Promise<OrbAutoJobStatus> {
  const mw = await fetchMovementWatchJobStatus();
  return {
    jobType: mw.jobType,
    kind: mw.kind ?? "movement_watch",
    status: mw.status,
    symbols: mw.symbols,
    tradeDate: mw.tradeDate,
    message: mw.message,
    pollIntervalSeconds: mw.pollIntervalSeconds,
  };
}

/** @deprecated Use stopMovementWatchJob */
export async function stopOrb5mAutoJobAws(
  reason: "cancelled" | "completed" = "cancelled",
): Promise<OrbAutoJobStatus> {
  const mw = await stopMovementWatchJob(reason);
  return {
    jobType: mw.jobType,
    kind: mw.kind ?? "movement_watch",
    status: mw.status,
    symbols: mw.symbols,
    message: mw.message,
    pollIntervalSeconds: mw.pollIntervalSeconds,
  };
}
