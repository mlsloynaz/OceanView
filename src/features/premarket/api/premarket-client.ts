import type {
  PremarketResultResponse,
  PremarketStartRequest,
  PremarketStopResponse,
} from "../types";
import { MOCK_PREMARKET_RESULT, nextMockPremarketStart } from "./mock-data";

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "/api";
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
};

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new PremarketApiError("VITE_API_BASE_URL is not set.");
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
