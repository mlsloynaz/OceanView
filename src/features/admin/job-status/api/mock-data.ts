import type { JobsStatusResponse } from "../types";

export function buildMockJobsStatus(): JobsStatusResponse {
  const now = Date.now();
  return {
    jobs: [
      {
        jobType: "candles",
        lastRun: {
          runId: "candles-sched-mock",
          kind: "refresh",
          status: "completed",
          trigger: "schedule",
          message:
            "Scheduled candle refresh finished: 42 succeeded, 0 failed, 0 skipped.",
          startedAt: new Date(now - 45 * 60_000).toISOString(),
          finishedAt: new Date(now - 30 * 60_000).toISOString(),
          summary: { total: 42, succeeded: 42, failed: 0, skipped: 0 },
        },
      },
      {
        jobType: "market",
        lastRun: {
          runId: "market-mock-1",
          kind: null,
          status: "idle",
          trigger: null,
          message: null,
          startedAt: null,
          finishedAt: null,
        },
      },
      {
        jobType: "preselection",
        lastRun: {
          runId: "presel-mock-1",
          kind: null,
          status: "completed",
          trigger: null,
          message: "Preselection complete.",
          startedAt: new Date(now - 3 * 60 * 60_000).toISOString(),
          finishedAt: new Date(now - 3 * 60 * 60_000 + 90_000).toISOString(),
          summary: { total: 120, succeeded: 120, failed: 0, skipped: 0 },
        },
      },
      {
        jobType: "movement_profiles",
        lastRun: {
          runId: "mvprof-mock-1",
          kind: "build_movement_profiles",
          status: "completed",
          trigger: "manual",
          message:
            "Movement profile build finished: 12 succeeded, 0 failed, 0 skipped.",
          startedAt: new Date(now - 2 * 60 * 60_000).toISOString(),
          finishedAt: new Date(now - 2 * 60 * 60_000 + 8 * 60_000).toISOString(),
          summary: { total: 12, succeeded: 12, failed: 0, skipped: 0 },
        },
      },
    ],
  };
}
