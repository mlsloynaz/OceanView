import { apiFetch, errorMessageFromBody, getApiBaseUrl, readResponseBody } from "@/shared/api/api-fetch";
import type {
  LearningJobSummary,
  LearningObservation,
  LearningObservationsListResponse,
  LearningOutcome,
  LearningOutcomesRunResponse,
} from "../types";

export class LearningApiError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "LearningApiError";
    this.status = status;
  }
}

const USE_MOCK = import.meta.env.VITE_USE_MOCK_LEARNING === "true";

function mockObservation(status: string, i: number): LearningObservation {
  return {
    observationId: `obs-mock-${status}-${i}`,
    runId: "mkt-latest",
    symbol: i % 2 === 0 ? "QQQ" : "SPY",
    observedAt: "2026-07-30T10:15:00-04:00",
    tradeDate: "2026-07-30",
    source: "market",
    strategyId: "estrategia-05",
    strategyVersion: "v1",
    direction: i % 2 === 0 ? "CALL" : "PUT",
    qualityPct: 80 + (i % 3) * 5,
    outcomeStatus: status,
    ruleResults: [
      { ruleKey: "vol_bb_expand_15m", status: "met", label: "Vol BB expand 15m" },
      { ruleKey: "open_inside_bb_15m", status: "met", label: "Open inside BB" },
      { ruleKey: "confirm_entry_15m", status: status === "complete" ? "met" : "partial" },
    ],
    movementProfileSnapshot: { expectedMfePct: 0.8, suggestedStopPct: 0.3 },
    featureSchemaVersion: "foundation-v1",
  };
}

export function learningUsesMock(): boolean {
  return USE_MOCK;
}

export function learningApiBaseUrl(): string | undefined {
  return getApiBaseUrl() || undefined;
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await readResponseBody(response);
  if (!response.ok) {
    throw new LearningApiError(errorMessageFromBody(body, `HTTP ${response.status}`), response.status);
  }
  return body as T;
}

export async function listLearningObservations(
  outcomeStatus: string,
  limit = 50,
): Promise<LearningObservationsListResponse> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 250));
    const observations = Array.from({ length: outcomeStatus === "pending" ? 3 : 5 }, (_, i) =>
      mockObservation(outcomeStatus, i),
    );
    return { outcomeStatus, count: observations.length, observations };
  }
  const q = new URLSearchParams({
    outcomeStatus,
    limit: String(limit),
  });
  const response = await apiFetch(`/learning/observations?${q.toString()}`);
  return parseOrThrow<LearningObservationsListResponse>(response);
}

export async function getLearningObservation(observationId: string): Promise<LearningObservation> {
  if (USE_MOCK) {
    return mockObservation("complete", 0);
  }
  const response = await apiFetch(`/learning/observations/${encodeURIComponent(observationId)}`);
  return parseOrThrow<LearningObservation>(response);
}

export async function getLearningOutcome(observationId: string): Promise<LearningOutcome> {
  if (USE_MOCK) {
    return {
      observationId,
      status: "complete",
      completedAt: "2026-07-30T12:30:00-04:00",
      symbol: "QQQ",
      direction: "CALL",
      maxFavorableExcursionPct: 0.91,
      maxAdverseExcursionPct: 0.27,
      targetBeforeStop: true,
      targetReached: true,
      stopReached: false,
      barsToTarget: 3,
      directionCorrect: true,
      primaryHorizonId: "bars_4_15m",
      horizons: [
        {
          horizonId: "bars_4_15m",
          timeframe: "15m",
          bars: 4,
          barsAvailable: 4,
          complete: true,
          maxFavorableExcursionPct: 0.91,
          maxAdverseExcursionPct: 0.27,
          targetBeforeStop: true,
          targetReached: true,
          stopReached: false,
          barsToTarget: 3,
          directionCorrect: true,
        },
        {
          horizonId: "bars_8_15m",
          timeframe: "15m",
          bars: 8,
          barsAvailable: 8,
          complete: true,
          maxFavorableExcursionPct: 1.2,
          maxAdverseExcursionPct: 0.35,
          targetBeforeStop: true,
          targetReached: true,
          stopReached: false,
          barsToTarget: 3,
          directionCorrect: true,
        },
      ],
    };
  }
  const response = await apiFetch(`/learning/outcomes/${encodeURIComponent(observationId)}`);
  return parseOrThrow<LearningOutcome>(response);
}

export async function runLearningOutcomes(opts?: {
  limit?: number;
  sync?: boolean;
}): Promise<LearningOutcomesRunResponse> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400));
    return {
      status: opts?.sync ? "complete" : "queued",
      message: opts?.sync ? undefined : "Learning outcome worker started.",
      limit: opts?.limit ?? 50,
      summary: { scanned: 8, completed: 5, stillPending: 2, skipped: 1, errors: 0 },
    };
  }
  const response = await apiFetch("/learning/outcomes/run", {
    method: "POST",
    body: JSON.stringify({
      limit: opts?.limit ?? 50,
      sync: Boolean(opts?.sync),
    }),
  });
  return parseOrThrow<LearningOutcomesRunResponse>(response);
}

export async function getLearningJobStatus(): Promise<LearningJobSummary | null> {
  if (USE_MOCK) {
    return {
      status: "complete",
      startedAt: "2026-07-30T12:00:00Z",
      finishedAt: "2026-07-30T12:01:00Z",
      summary: { scanned: 8, completed: 5, stillPending: 2, skipped: 1, errors: 0 },
    };
  }
  const response = await apiFetch("/jobs/status?jobType=learning_outcomes");
  const body = await parseOrThrow<{
    jobType?: string;
    lastRun?: {
      status?: string;
      startedAt?: string | null;
      finishedAt?: string | null;
      summary?: LearningOutcomesRunResponse["summary"];
    } | null;
  }>(response);
  const last = body.lastRun;
  if (!last) return null;
  return {
    status: String(last.status || "idle"),
    startedAt: last.startedAt ?? null,
    finishedAt: last.finishedAt ?? null,
    summary: last.summary,
  };
}
