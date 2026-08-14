import { cn } from "@/shared/lib/cn";
import type {
  BannerKind,
  JobLastRun,
  JobStatusCardModel,
  JobStatusEntry,
} from "./types";

const JOB_TITLES: Record<string, string> = {
  candles: "Candles",
  market: "Market assess",
  premarket: "Premarket",
  preselection: "Tickers SemiFinal",
  movement_profiles: "Movement profiles",
  gap_forecast: "Gap forecast 15:25",
};

export function jobTypeTitle(jobType: string): string {
  return JOB_TITLES[jobType] ?? jobType;
}

export function cardClass(kind: BannerKind): string {
  return cn(
    "rounded-xl border px-3 py-3 text-left shadow-sm transition-colors",
    kind === "error" && "border-ocean-danger-border bg-ocean-danger-muted/80",
    kind === "warn" && "border-amber-500/40 bg-amber-500/10",
    kind === "running" && "border-amber-500/40 bg-amber-500/10",
    kind === "ok" && "border-ocean-teal/40 bg-ocean-teal/10",
    kind === "none" && "border-ocean-mid/50 bg-ocean-deep/40",
  );
}

export function statusToneClass(kind: BannerKind): string {
  return cn(
    kind === "error" && "text-ocean-danger",
    kind === "warn" && "text-amber-900 dark:text-amber-100",
    kind === "running" && "text-amber-900 dark:text-amber-100",
    kind === "ok" && "text-ocean-teal-dim dark:text-ocean-teal",
    kind === "none" && "text-ocean-sand",
  );
}

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function kindFromStatus(status: string, summary?: JobLastRun["summary"]): BannerKind {
  if (status === "running" || status === "ready") return "running";
  if (status === "failed") return "error";
  if (status === "partial") return "warn";
  if (status === "completed") {
    if (summary && summary.failed > 0) return "warn";
    return "ok";
  }
  return "none";
}

function defaultBody(jobType: string, run: JobLastRun): string {
  const label = jobTypeTitle(jobType);
  const scheduled = run.trigger === "schedule" ? "Scheduled " : "";
  const kind = run.kind ? `${run.kind} ` : "";

  if (run.status === "running" || run.status === "ready") {
    const progress =
      run.progress != null ? ` (${run.progress.completed}/${run.progress.total})` : "";
    return `${scheduled}${kind}${label.toLowerCase()} job running${progress}.`;
  }
  if (run.status === "failed") {
    return `${scheduled}${label} job failed.`;
  }
  if (run.status === "partial") {
    return `${scheduled}${label} job completed with partial failures.`;
  }
  if (run.status === "completed") {
    if (run.summary) {
      return (
        `${scheduled}${label} finished: ${run.summary.succeeded} succeeded, ` +
        `${run.summary.failed} failed, ${run.summary.skipped} skipped.`
      );
    }
    return `${scheduled}${label} job completed.`;
  }
  return `No recent ${label.toLowerCase()} activity.`;
}

function metaLine(run: JobLastRun): string | null {
  const parts: string[] = [];
  if (run.trigger === "schedule") parts.push("trigger: schedule");
  else if (run.trigger) parts.push(`trigger: ${run.trigger}`);
  const finished = formatWhen(run.finishedAt);
  const started = formatWhen(run.startedAt);
  if (finished) parts.push(`finished ${finished}`);
  else if (started) parts.push(`started ${started}`);
  if (run.status === "running" && run.progress) {
    parts.push(`${run.progress.completed}/${run.progress.total}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

export function cardFromJob(entry: JobStatusEntry): JobStatusCardModel {
  const title = jobTypeTitle(entry.jobType);
  const run = entry.lastRun;

  if (!run || run.status === "idle") {
    return {
      jobType: entry.jobType,
      title,
      kind: "none",
      body: "No active job. Latest run will appear here after a schedule or manual start.",
      meta: null,
      runId: run?.runId || null,
    };
  }

  return {
    jobType: entry.jobType,
    title,
    kind: kindFromStatus(String(run.status), run.summary),
    body: run.message?.trim() || defaultBody(entry.jobType, run),
    meta: metaLine(run),
    runId: run.runId || null,
  };
}

export function cardsFromJobs(jobs: JobStatusEntry[]): JobStatusCardModel[] {
  const order = ["candles", "market", "preselection", "premarket"];
  const rank = (jobType: string) => {
    const idx = order.indexOf(jobType);
    return idx === -1 ? order.length : idx;
  };
  return [...jobs]
    .sort((a, b) => rank(a.jobType) - rank(b.jobType) || a.jobType.localeCompare(b.jobType))
    .map(cardFromJob);
}
