import { MOCK_SETUP_SCAN_RESULT } from "./mock-data";
import type { PreselectionResultResponse } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "/api";
const USE_MOCK =
  import.meta.env.VITE_USE_MOCK_SETUP_SCAN === "true" ||
  import.meta.env.VITE_USE_MOCK_CANDLES === "true";

const MOCK_DELAY_MS = 400;

function delay(ms = MOCK_DELAY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new Error("VITE_API_BASE_URL is not set.");
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
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

export function setupScanUsesMock(): boolean {
  return USE_MOCK;
}

export function setupScanApiBaseUrl(): string | null {
  return API_BASE || null;
}

export async function postSetupScanRun(body?: {
  strategyIds?: string[];
  minScore?: number;
}): Promise<PreselectionResultResponse> {
  if (USE_MOCK) {
    await delay(1200);
    return { ...MOCK_SETUP_SCAN_RESULT, evaluatedAt: new Date().toISOString() };
  }
  return fetchJson<PreselectionResultResponse>("/preselection/run", {
    method: "POST",
    body: JSON.stringify({
      strategyIds: body?.strategyIds,
      options: { minScore: body?.minScore ?? 0 },
    }),
  });
}

export async function getSetupScanResult(runId?: string): Promise<PreselectionResultResponse> {
  if (USE_MOCK) {
    await delay();
    return { ...MOCK_SETUP_SCAN_RESULT };
  }
  const query = runId?.trim() ? `?runId=${encodeURIComponent(runId.trim())}` : "";
  return fetchJson<PreselectionResultResponse>(`/preselection/result${query}`);
}
