import { MOCK_SETUP_SCAN_RESULT } from "./mock-data";
import { mergePreselectionWithCatalogActive } from "../merge-catalog-active";
import { getTickersCatalog } from "../../tickers/api/tickers-client";
import type { PreselectionResultResponse } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "/api";
const USE_MOCK =
  import.meta.env.VITE_USE_MOCK_SETUP_SCAN === "true" ||
  import.meta.env.VITE_USE_MOCK_CANDLES === "true";

const MOCK_DELAY_MS = 400;
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 120;

function delay(ms = MOCK_DELAY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SetupScanApiError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "SetupScanApiError";
    this.status = status;
  }
}

async function fetchJson<T>(
  path: string,
  init?: RequestInit,
  okStatuses: number[] = [200],
): Promise<{ data: T; status: number }> {
  if (!API_BASE) {
    throw new SetupScanApiError("VITE_API_BASE_URL is not set.");
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
  if (!okStatuses.includes(response.status) && !response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `HTTP ${response.status}`;
    throw new SetupScanApiError(message, response.status);
  }
  return { data: body as T, status: response.status };
}

export function setupScanUsesMock(): boolean {
  return USE_MOCK;
}

export function setupScanApiBaseUrl(): string | null {
  return API_BASE || null;
}

export type SetupScanRunOptions = {
  strategyIds?: string[];
  minScore?: number;
  simulationDate?: string;
};

export async function postSetupScanRun(body?: SetupScanRunOptions): Promise<PreselectionResultResponse> {
  if (USE_MOCK) {
    await delay(1200);
    const simDate = body?.simulationDate;
    return {
      ...MOCK_SETUP_SCAN_RESULT,
      evaluatedAt: new Date().toISOString(),
      simulated: Boolean(simDate),
      simulationDate: simDate ?? null,
      tradeDate: simDate ?? MOCK_SETUP_SCAN_RESULT.tradeDate,
      simulationTimeEt: simDate ? `${simDate}T16:00:00-04:00` : MOCK_SETUP_SCAN_RESULT.simulationTimeEt,
    };
  }
  const { data } = await fetchJson<PreselectionResultResponse>(
    "/preselection/run",
    {
      method: "POST",
      body: JSON.stringify({
        strategyIds: body?.strategyIds,
        simulationDate: body?.simulationDate,
        options: { minScore: body?.minScore ?? 0 },
      }),
    },
    [200, 202],
  );
  return data;
}

export async function getSetupScanResult(runId?: string): Promise<PreselectionResultResponse> {
  if (USE_MOCK) {
    await delay();
    const { tickers } = await getTickersCatalog();
    return mergePreselectionWithCatalogActive({ ...MOCK_SETUP_SCAN_RESULT }, tickers);
  }
  const query = runId?.trim() ? `?runId=${encodeURIComponent(runId.trim())}` : "";
  const { data } = await fetchJson<PreselectionResultResponse>(`/preselection/result${query}`);
  return data;
}

function isTerminalStatus(status: string | undefined): boolean {
  const value = (status ?? "").toLowerCase();
  return value === "complete" || value === "completed" || value === "failed";
}

export async function pollSetupScanResult(
  runId?: string,
  onProgress?: (payload: PreselectionResultResponse) => void,
): Promise<PreselectionResultResponse> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await delay(POLL_INTERVAL_MS);
    }
    const payload = await getSetupScanResult(runId);
    onProgress?.(payload);
    if (isTerminalStatus(payload.status)) {
      if ((payload.status ?? "").toLowerCase() === "failed") {
        throw new SetupScanApiError("Tickers SemiFinal failed.", 500);
      }
      return payload;
    }
  }
  throw new SetupScanApiError("Tickers SemiFinal timed out while waiting for results.", 504);
}
