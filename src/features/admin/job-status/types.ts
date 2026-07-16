export type BannerKind = "ok" | "warn" | "error" | "running" | "none";

export type JobRunStatus = "idle" | "running" | "ready" | "completed" | "failed" | "partial";

export type JobLastRun = {
  runId: string;
  kind: string | null;
  status: JobRunStatus | string;
  trigger: string | null;
  message: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  summary?: {
    total: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
  progress?: {
    completed: number;
    total: number;
  };
};

export type JobStatusEntry = {
  jobType: string;
  lastRun: JobLastRun | null;
};

export type JobsStatusResponse = {
  jobs: JobStatusEntry[];
};

export type JobStatusCardModel = {
  jobType: string;
  title: string;
  kind: BannerKind;
  body: string;
  meta: string | null;
  runId: string | null;
};
