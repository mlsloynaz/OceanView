import { MOCK_GAP_FORECAST, MOCK_SETUP_SCAN_RESULT } from "./mock-data";
import { mergePreselectionWithCatalogActive } from "../merge-catalog-active";
import { getTickersCatalog } from "../../tickers/api/tickers-client";
import type {
  GapForecastResult,
  PreselectionCandidateMode,
  PreselectionResultResponse,
} from "../types";
import { apiFetch, getApiBaseUrl, readResponseBody } from "@/shared/api/api-fetch";

const API_BASE = getApiBaseUrl();
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
  const response = await apiFetch(path, init);
  const body = await readResponseBody(response);
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
  /** eod = history SemiFinal; open = 9:25 visual (history + EH in memory). */
  mode?: PreselectionCandidateMode;
};

export async function postSetupScanRun(body?: SetupScanRunOptions): Promise<PreselectionResultResponse> {
  if (USE_MOCK) {
    await delay(1200);
    const simDate = body?.simulationDate;
    const mode = body?.mode ?? "eod";
    return {
      ...MOCK_SETUP_SCAN_RESULT,
      evaluatedAt: new Date().toISOString(),
      simulated: Boolean(simDate),
      simulationDate: simDate ?? null,
      tradeDate: simDate ?? MOCK_SETUP_SCAN_RESULT.tradeDate,
      simulationTimeEt: simDate ? `${simDate}T16:00:00-04:00` : MOCK_SETUP_SCAN_RESULT.simulationTimeEt,
      mode,
      visualOnly: mode === "open",
      message:
        mode === "open"
          ? "Mock 9:25 visual scan (not saved over EOD)."
          : MOCK_SETUP_SCAN_RESULT.message,
    };
  }
  const { data } = await fetchJson<PreselectionResultResponse>(
    "/preselection/run",
    {
      method: "POST",
      body: JSON.stringify({
        strategyIds: body?.strategyIds,
        simulationDate: body?.simulationDate,
        mode: body?.mode ?? "eod",
        options: { minScore: body?.minScore ?? 0, mode: body?.mode ?? "eod" },
      }),
    },
    [200, 202],
  );
  return data;
}

export async function getSetupScanResult(
  runId?: string,
  mode?: PreselectionCandidateMode,
): Promise<PreselectionResultResponse> {
  if (USE_MOCK) {
    await delay();
    const { tickers } = await getTickersCatalog();
    return mergePreselectionWithCatalogActive({ ...MOCK_SETUP_SCAN_RESULT }, tickers);
  }
  const params = new URLSearchParams();
  if (runId?.trim()) params.set("runId", runId.trim());
  if (mode) params.set("mode", mode);
  const query = params.toString() ? `?${params.toString()}` : "";
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
  mode?: PreselectionCandidateMode,
): Promise<PreselectionResultResponse> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await delay(POLL_INTERVAL_MS);
    }
    const payload = await getSetupScanResult(runId, mode);
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

export async function postGapForecastRun(body?: {
  simulationDate?: string;
  refreshCandles?: boolean;
}): Promise<GapForecastResult> {
  if (USE_MOCK) {
    await delay(800);
    return {
      ...MOCK_GAP_FORECAST,
      status: "running",
      evaluatedAt: new Date().toISOString(),
      simulationDate: body?.simulationDate ?? null,
      simulated: Boolean(body?.simulationDate),
    };
  }
  const { data } = await fetchJson<GapForecastResult>(
    "/preselection/gap-forecast/run",
    {
      method: "POST",
      body: JSON.stringify({
        simulationDate: body?.simulationDate,
        refreshCandles: body?.refreshCandles ?? true,
      }),
    },
    [200, 202],
  );
  return data;
}

export async function getGapForecastResult(): Promise<GapForecastResult> {
  if (USE_MOCK) {
    await delay();
    return { ...MOCK_GAP_FORECAST };
  }
  const { data } = await fetchJson<GapForecastResult>("/preselection/gap-forecast");
  return data;
}

export async function pollGapForecastResult(
  onProgress?: (payload: GapForecastResult) => void,
): Promise<GapForecastResult> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await delay(POLL_INTERVAL_MS);
    }
    const payload = await getGapForecastResult();
    onProgress?.(payload);
    if (isTerminalStatus(payload.status) || payload.status === "empty") {
      if ((payload.status ?? "").toLowerCase() === "failed") {
        throw new SetupScanApiError("Gap forecast failed.", 500);
      }
      return payload;
    }
  }
  throw new SetupScanApiError("Gap forecast timed out while waiting for results.", 504);
}
