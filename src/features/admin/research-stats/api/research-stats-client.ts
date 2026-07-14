import { apiFetch, getApiBaseUrl, readResponseBody } from "@/shared/api/api-fetch";
import { buildMockResearchStatsResult } from "./mock-data";
import type { ResearchStatsRequest, ResearchStatsResult } from "../types";

const API_BASE = getApiBaseUrl();
const USE_MOCK =
  import.meta.env.VITE_USE_MOCK_RESEARCH_STATS === "true" ||
  import.meta.env.VITE_USE_MOCK_CANDLES === "true";

export function researchStatsUsesMock(): boolean {
  return USE_MOCK;
}

export function researchStatsApiBaseUrl(): string | undefined {
  return API_BASE || undefined;
}

export class ResearchStatsApiError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "ResearchStatsApiError";
    this.status = status;
    this.code = code;
  }
}

/** Runs research and overwrites the single stored result on the server. */
export async function runResearchStats(
  request: ResearchStatsRequest,
): Promise<ResearchStatsResult> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400));
    return buildMockResearchStatsResult(request);
  }

  if (!API_BASE) {
    throw new ResearchStatsApiError("VITE_API_BASE_URL is not set.");
  }

  const response = await apiFetch("/research-stats/run", {
    method: "POST",
    body: JSON.stringify(request),
  });
  const body = await readResponseBody(response);

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `HTTP ${response.status}`;
    const code =
      typeof body === "object" &&
      body !== null &&
      "code" in body &&
      typeof (body as { code: unknown }).code === "string"
        ? (body as { code: string }).code
        : undefined;
    throw new ResearchStatsApiError(message, response.status, code);
  }

  return body as ResearchStatsResult;
}
