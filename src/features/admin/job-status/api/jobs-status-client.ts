import { apiFetch, getApiBaseUrl, readResponseBody } from "@/shared/api/api-fetch";
import type { JobLastRun, JobStatusEntry, JobsStatusResponse } from "../types";
import { buildMockJobsStatus } from "./mock-data";

const MOCK_DELAY_MS = 220;
const USE_MOCK = import.meta.env.VITE_USE_MOCK_JOBS_STATUS === "true";

type ApiProgress = { done?: number; completed?: number; total: number };

type ApiLastRun = {
  runId?: string;
  jobId?: string;
  kind?: string | null;
  status?: string;
  trigger?: string | null;
  message?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  summary?: JobLastRun["summary"];
  progress?: ApiProgress;
};

type ApiJobEntry = {
  jobType?: string;
  lastRun?: ApiLastRun | null;
};

type ApiListPayload = {
  jobs?: ApiJobEntry[];
};

function delay(ms = MOCK_DELAY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapProgress(progress: ApiProgress | undefined): JobLastRun["progress"] | undefined {
  if (!progress) return undefined;
  return {
    completed: progress.completed ?? progress.done ?? 0,
    total: progress.total,
  };
}

function mapLastRun(raw: ApiLastRun | null | undefined): JobLastRun | null {
  if (!raw) return null;
  return {
    runId: raw.runId ?? raw.jobId ?? "",
    kind: raw.kind ?? null,
    status: raw.status ?? "idle",
    trigger: raw.trigger ?? null,
    message: raw.message ?? null,
    startedAt: raw.startedAt ?? null,
    finishedAt: raw.finishedAt ?? null,
    summary: raw.summary,
    progress: mapProgress(raw.progress),
  };
}

function mapJobsPayload(payload: ApiListPayload): JobsStatusResponse {
  const jobs: JobStatusEntry[] = (payload.jobs ?? []).map((entry) => ({
    jobType: String(entry.jobType || "").toLowerCase(),
    lastRun: mapLastRun(entry.lastRun),
  }));
  return { jobs };
}

export function jobsStatusApiUsesMock(): boolean {
  return USE_MOCK;
}

export function jobsStatusApiBaseUrl(): string | null {
  const base = getApiBaseUrl();
  return base || null;
}

export async function getJobsStatus(): Promise<JobsStatusResponse> {
  if (USE_MOCK) {
    await delay();
    return buildMockJobsStatus();
  }
  const response = await apiFetch("/jobs/status");
  const body = await readResponseBody(response);
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
  return mapJobsPayload((body ?? {}) as ApiListPayload);
}
