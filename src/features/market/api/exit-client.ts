import { apiFetch, getApiBaseUrl, readResponseBody } from "@/shared/api/api-fetch";

const USE_MOCK = import.meta.env.VITE_USE_MOCK_MARKET === "true";

export class MarketExitApiError extends Error {
  readonly code: string | undefined;
  readonly status: number | undefined;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = "MarketExitApiError";
    this.code = code;
    this.status = status;
  }
}

export type PositionExitSeverity = "info" | "warn" | "exit_suggested";

export type PositionExitWarning = {
  code: string;
  severity: PositionExitSeverity | string;
  title: string;
  detail: string;
  evidence?: Record<string, unknown>;
};

export type PositionExitCheckRequest = {
  symbol: string;
  direction: "CALL" | "PUT";
  entryPrice?: number | null;
  strategyId?: string | null;
  refreshCandles?: boolean;
  /** As-of ET datetime (ISO). When set, uses stored candles (Simulate). */
  simulationTimeEt?: string;
  /** Bypass market-hours pause (rare). */
  force?: boolean;
};

export type PositionExitCheckResponse = {
  symbol: string;
  name?: string | null;
  direction: "CALL" | "PUT";
  strategyId?: string | null;
  entryPrice?: number | null;
  spot?: number | null;
  paused?: boolean;
  message?: string | null;
  severity?: PositionExitSeverity | null;
  exitSuggested?: boolean;
  warnings?: PositionExitWarning[];
  clearPath?: Record<string, unknown> | null;
  optionRoom?: {
    roomPct?: number | null;
    estimatedOptionGainPct?: number | null;
  } | null;
  movementProfile?: Record<string, unknown> | null;
  /** Latest 1m BB/candle bias (alcista/bajista); supporting only. */
  biasTrend1m?: string | null;
  biasEvidence?: Record<string, unknown> | null;
  /** ok | watch | weakening | invalidated */
  thesisStatus?: string | null;
  thesis?: {
    tier?: string | null;
    reasons?: string[];
    activeCategories?: string[];
    hardInvalidation?: boolean;
    vwapFailedReclaim?: boolean;
    microStructureBreak?: boolean;
  } | null;
  checkedAt?: string;
  simulationTimeEt?: string | null;
};

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  const body = await readResponseBody(res);
  if (!res.ok) {
    const errBody = body as { error?: string; code?: string; message?: string } | null;
    throw new MarketExitApiError(
      errBody?.error || errBody?.message || `HTTP ${res.status}`,
      errBody?.code,
      res.status,
    );
  }
  return body as T;
}

/**
 * POST /market/exit/check — bias / obstacles / room / structure for an open trade side.
 */
export async function checkPositionExit(
  body: PositionExitCheckRequest,
): Promise<PositionExitCheckResponse> {
  const symbol = String(body.symbol || "").trim().toUpperCase();
  const direction = body.direction === "PUT" ? "PUT" : "CALL";

  if (USE_MOCK) {
    return {
      symbol,
      direction,
      paused: false,
      severity: "exit_suggested",
      exitSuggested: true,
      warnings: [
        {
          code: "mock_exit",
          severity: "exit_suggested",
          title: "Mock exit suggested",
          detail: "VITE_USE_MOCK_MARKET — simulated exit fire for UI testing.",
        },
      ],
      checkedAt: new Date().toISOString(),
      simulationTimeEt: body.simulationTimeEt ?? null,
      message: null,
    };
  }

  void getApiBaseUrl();
  return fetchJson<PositionExitCheckResponse>("/market/exit/check", {
    method: "POST",
    body: JSON.stringify({
      symbol,
      direction,
      refreshCandles: body.refreshCandles ?? !body.simulationTimeEt,
      ...(body.entryPrice != null ? { entryPrice: body.entryPrice } : {}),
      ...(body.strategyId ? { strategyId: body.strategyId } : {}),
      ...(body.simulationTimeEt ? { simulationTimeEt: body.simulationTimeEt } : {}),
      ...(body.force ? { force: true } : {}),
    }),
  });
}
