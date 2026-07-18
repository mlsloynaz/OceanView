import { apiFetch, getApiBaseUrl, readResponseBody } from "@/shared/api/api-fetch";
import type { BestResultMonitorStatus, BestResultMonitorTicker } from "../types";

const API_BASE = getApiBaseUrl();
const USE_MOCK = import.meta.env.VITE_USE_MOCK_PREMARKET === "true";

export class BestResultApiError extends Error {
  readonly code: string | undefined;
  readonly status: number | undefined;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = "BestResultApiError";
    this.code = code;
    this.status = status;
  }
}

export const BEST_RESULT_ERROR_MESSAGES: Record<string, string> = {
  BEST_RESULT_INVALID: "Invalid best-result monitor request.",
  BEST_RESULT_RUN_NOT_FOUND: "No premarket result for that run — evaluate first.",
  BEST_RESULT_EMPTY: "No Best results on this run — evaluate first.",
  BEST_RESULT_NOT_FOUND: "No best-result monitor session.",
};

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new BestResultApiError("VITE_API_BASE_URL is not set.");
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
    throw new BestResultApiError(
      (code && BEST_RESULT_ERROR_MESSAGES[code]) || message,
      code,
      response.status,
    );
  }
  return body as T;
}

let mockMonitor: BestResultMonitorStatus | null = null;

function mockTickersFromSymbols(
  symbols: Array<{ symbol: string; direction?: string | null; name?: string | null }>,
): BestResultMonitorTicker[] {
  return symbols.map((row, i) => {
    const baseline = 100 + i * 10;
    const spot = baseline * (1 + 0.002 * (i + 1));
    const direction = (row.direction === "PUT" ? "PUT" : "CALL") as "CALL" | "PUT";
    const strike = direction === "CALL" ? Math.round(spot) : Math.round(spot);
    const ask = 0.72 + i * 0.02;
    return {
      symbol: row.symbol,
      name: row.name,
      direction,
      baselineSpot: baseline,
      spot: Number(spot.toFixed(2)),
      movePct: Number((((spot - baseline) / baseline) * 100).toFixed(2)),
      targetSpot: direction === "CALL" ? baseline * 1.12 : baseline * 0.88,
      pick: {
        symbol: row.symbol,
        strike,
        expiration: "2026-07-18",
        dte: 1,
        ask,
        bid: ask - 0.04,
        mark: ask - 0.02,
        distancePct: 0.2,
        tomar: true,
        rating: 4,
      },
      estimate: {
        atMoveCapPct: 12,
        targetSpot: direction === "CALL" ? baseline * 1.12 : baseline * 0.88,
        exitMarkEst: Number((ask * 1.45).toFixed(2)),
        gainPct: 45,
        gainUsdPerContract: Number(((ask * 1.45 - ask) * 100).toFixed(2)),
        moveDone: false,
      },
      error: null,
    };
  });
}

export async function postBestResultMonitorStart(body: {
  runId: string;
  moveCapPct?: number;
}): Promise<BestResultMonitorStatus> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400));
    mockMonitor = {
      monitorId: `brmon-mock-${Date.now()}`,
      status: "running",
      runId: body.runId,
      moveCapPct: body.moveCapPct ?? 12,
      polledAt: new Date().toISOString(),
      tickers: mockTickersFromSymbols([
        { symbol: "AAPL", direction: "CALL", name: "Apple Inc." },
        { symbol: "LOW", direction: "CALL", name: "Lowe's" },
        { symbol: "HD", direction: "CALL", name: "Home Depot" },
      ]),
    };
    return mockMonitor;
  }
  return fetchJson<BestResultMonitorStatus>("/best-results/monitor/start", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchBestResultMonitorStatus(
  monitorId?: string | null,
): Promise<BestResultMonitorStatus> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 200));
    if (!mockMonitor || mockMonitor.status !== "running") {
      throw new BestResultApiError("No best-result monitor session", "BEST_RESULT_NOT_FOUND", 404);
    }
    const bumped = {
      ...mockMonitor,
      polledAt: new Date().toISOString(),
      tickers: mockMonitor.tickers.map((t) => ({
        ...t,
        spot: Number(((t.spot ?? t.baselineSpot ?? 0) * 1.0005).toFixed(2)),
        movePct: Number(
          (
            (((t.spot ?? 0) * 1.0005 - (t.baselineSpot ?? 0)) / (t.baselineSpot || 1)) *
            100
          ).toFixed(2),
        ),
      })),
    };
    mockMonitor = bumped;
    return bumped;
  }
  const q = monitorId ? `?monitorId=${encodeURIComponent(monitorId)}` : "";
  return fetchJson<BestResultMonitorStatus>(`/best-results/monitor/status${q}`);
}

export async function postBestResultMonitorStop(
  monitorId?: string | null,
): Promise<BestResultMonitorStatus> {
  if (USE_MOCK) {
    if (mockMonitor) {
      mockMonitor = { ...mockMonitor, status: "stopped", message: "Best-result monitor stopped." };
      return mockMonitor;
    }
    return { status: "idle", tickers: [], message: "No best-result monitor is running." };
  }
  return fetchJson<BestResultMonitorStatus>("/best-results/monitor/stop", {
    method: "POST",
    body: JSON.stringify(monitorId ? { monitorId } : {}),
  });
}
