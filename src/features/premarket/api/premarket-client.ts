import type {
  PremarketResultResponse,
  PremarketStartRequest,
  PremarketStopResponse,
} from "../types";
import { MOCK_PREMARKET_RESULT, nextMockPremarketStart } from "./mock-data";
import { apiFetch, getApiBaseUrl, readResponseBody } from "@/shared/api/api-fetch";

const API_BASE = getApiBaseUrl();
const USE_MOCK = import.meta.env.VITE_USE_MOCK_PREMARKET === "true";

export class PremarketApiError extends Error {
  readonly code: string | undefined;
  readonly status: number | undefined;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = "PremarketApiError";
    this.code = code;
    this.status = status;
  }
}

export const PREMARKET_ERROR_MESSAGES: Record<string, string> = {
  PREMARKET_CONFLICT: "Another premarket evaluate run is already in progress.",
  PREMARKET_NOT_FOUND: "No saved premarket result yet.",
  PREMARKET_INVALID_TIME: "Invalid simulation time.",
  DYNAMIC_EVAL_CONFLICT: "Another evaluate run is already in progress.",
  DYNAMIC_EVAL_INVALID: "Invalid evaluate request.",
  DYNAMIC_EVAL_NO_STRATEGIES:
    "No active strategies — activate at least one screen in Strategy builder.",
  DYNAMIC_STRATEGY_NOT_FOUND: "Unknown strategy id — refresh the catalog and try again.",
};

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new PremarketApiError("VITE_API_BASE_URL is not set.");
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
    throw new PremarketApiError(message, code, response.status);
  }
  return body as T;
}

function withRunId(path: string, runId?: string | null): string {
  if (!runId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}runId=${encodeURIComponent(runId)}`;
}

export function premarketUsesMock(): boolean {
  return USE_MOCK;
}

export function premarketApiBaseUrl(): string | null {
  return API_BASE || null;
}

export async function postPremarketStart(
  body: PremarketStartRequest = {},
): Promise<PremarketResultResponse> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 900));
    return nextMockPremarketStart();
  }
  return fetchJson<PremarketResultResponse>("/premarket/evaluate/start", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function postPremarketStop(): Promise<PremarketStopResponse> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 200));
    return {
      status: "stopping",
      message: "Stop requested (mock).",
      stopRequested: true,
    };
  }
  return fetchJson<PremarketStopResponse>("/premarket/evaluate/stop", {
    method: "POST",
    body: "{}",
  });
}

export async function fetchPremarketResult(
  runId?: string | null,
): Promise<PremarketResultResponse> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 150));
    return { ...MOCK_PREMARKET_RESULT };
  }
  return fetchJson<PremarketResultResponse>(withRunId("/premarket/evaluate/result", runId));
}

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_DURATION_MS = 10_000;

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isEvaluateUsable(status: string | undefined): boolean {
  const value = (status ?? "").toLowerCase();
  return value === "ready" || value === "complete" || value === "partial";
}

function isEvaluateTerminal(status: string | undefined): boolean {
  const value = (status ?? "").toLowerCase();
  return value === "complete" || value === "partial" || value === "failed" || value === "stopped";
}

export function isPremarketJobActive(status: string | undefined): boolean {
  const value = (status ?? "").toLowerCase();
  return value === "running" || value === "ready" || value === "stopping";
}

/** Poll up to 10s after start — does not throw on timeout. */
export async function pollPremarketEvaluate(
  runId?: string | null,
  onProgress?: (payload: PremarketResultResponse) => void,
): Promise<PremarketResultResponse | null> {
  const deadline = Date.now() + POLL_MAX_DURATION_MS;
  let last: PremarketResultResponse | null = null;
  while (Date.now() < deadline) {
    last = await fetchPremarketResult(runId);
    onProgress?.(last);
    if (isEvaluateTerminal(last.status)) {
      return last;
    }
    if (isEvaluateUsable(last.status) && !isPremarketJobActive(last.status)) {
      return last;
    }
    if (Date.now() + POLL_INTERVAL_MS >= deadline) {
      break;
    }
    await delay(POLL_INTERVAL_MS);
  }
  return last;
}
