import type {
  BannerKind,
  CandlesBanner,
  CandlesJob,
  ContextStatus,
  SymbolOutcome,
} from "./types";
import { cn } from "@/shared/lib/cn";

export function bannerClass(kind: BannerKind): string {
  return cn(
    "mb-3 rounded-lg border px-3 py-2 text-xs leading-snug",
    kind === "error" && "border-ocean-danger-border bg-ocean-danger-muted text-ocean-danger",
    kind === "warn" && "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
    kind === "running" && "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
    kind === "ok" && "border-ocean-teal/40 bg-ocean-teal/10 text-ocean-teal-dim dark:text-ocean-teal",
    kind === "none" && "border-ocean-mid/50 bg-ocean-deep/50 text-ocean-sand",
  );
}

export function outcomeClass(outcome: SymbolOutcome): string {
  return cn(
    "inline-block rounded px-2 py-0.5 text-xs font-medium",
    outcome === "success" && "bg-ocean-teal/15 text-ocean-teal-dim dark:text-ocean-teal",
    outcome === "failed" && "bg-ocean-danger-muted text-ocean-danger",
    outcome === "skipped" && "bg-ocean-mid/30 text-ocean-sand",
    outcome === "unknown" && "bg-ocean-deep text-ocean-sand",
  );
}

export function outcomeLabel(outcome: SymbolOutcome): string {
  switch (outcome) {
    case "success":
      return "Success";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
    default:
      return "Unknown";
  }
}

export function contextStatusClass(status: ContextStatus): string {
  return cn(
    "inline-block rounded px-2 py-0.5 text-xs font-medium",
    status === "ready" && "bg-ocean-teal/15 text-ocean-teal-dim dark:text-ocean-teal",
    status === "missing" && "bg-ocean-mid/30 text-ocean-sand",
    status === "error" && "bg-ocean-danger-muted text-ocean-danger",
  );
}

export function contextStatusLabel(status: ContextStatus): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "missing":
      return "Missing";
    case "error":
      return "Error";
    default:
      return status;
  }
}

export function formatIntervals(intervals: {
  daily?: { count: number; lastAt: string };
  hourly?: { count: number; lastAt: string };
  min15?: { count: number; lastAt: string };
}): string | null {
  const parts: string[] = [];
  if (intervals.daily) parts.push(`D:${intervals.daily.count}`);
  if (intervals.hourly) parts.push(`1h:${intervals.hourly.count}`);
  if (intervals.min15) parts.push(`15m:${intervals.min15.count}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function bannerFromJob(job: CandlesJob | null): CandlesBanner {
  if (!job || job.status === "idle") {
    return {
      kind: "none",
      title: "Candle intake",
      body: "No active job. Use Refresh status to read current state.",
    };
  }

  if (job.status === "running") {
    const progress =
      job.progress != null
        ? ` (${job.progress.completed}/${job.progress.total})`
        : "";
    return {
      kind: "running",
      title: "Candle intake",
      body: `${job.kind === "reset" ? "Reset" : "Refresh"} job running${progress}.`,
    };
  }

  if (job.status === "failed") {
    return {
      kind: "error",
      title: "Candle intake",
      body: "Last job failed.",
    };
  }

  if (job.status === "partial") {
    return {
      kind: "warn",
      title: "Candle intake",
      body: "Last job completed with partial failures.",
    };
  }

  const summary = job.summary;
  const body = summary
    ? `${summary.succeeded} succeeded, ${summary.failed} failed, ${summary.skipped} skipped.`
    : "Last job completed.";

  return {
    kind: summary && summary.failed > 0 ? "warn" : "ok",
    title: "Candle intake",
    body,
  };
}
