import type { CandidateViewModel } from "../models/CandidateViewModel";
import type { PositionExitCheckResponse } from "@/features/market/api/exit-client";

/** Apply exit-check result onto a Top Candidate row (local UI overlay). */
export function applyExitCheckToCandidate(
  candidate: CandidateViewModel,
  result: PositionExitCheckResponse,
): CandidateViewModel {
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  const actionable = warnings.filter(
    (w) => w.severity === "warn" || w.severity === "exit_suggested",
  );
  const exitSuggested = Boolean(result.exitSuggested);
  const watch = result.severity === "warn" || exitSuggested;

  const exitMonitor = {
    available: !result.paused,
    paused: Boolean(result.paused),
    message: result.message ?? null,
    severity: result.severity ?? null,
    exitSuggested,
    warnings,
    spot: result.spot ?? null,
    priorTrend1h: result.priorTrend1h ?? null,
    checkedAt: result.checkedAt ?? null,
  };

  if (result.paused) {
    return {
      ...candidate,
      exitMonitor,
      conflictReasons: [
        result.message || "Exit check paused outside market hours",
        ...candidate.conflictReasons,
      ].slice(0, 8),
    };
  }

  if (!watch) {
    return {
      ...candidate,
      exitMonitor,
    };
  }

  const extraConflicts = actionable.map((w) => `${w.title}: ${w.detail}`);
  return {
    ...candidate,
    readiness: "weakening",
    conflictReasons: [...extraConflicts, ...candidate.conflictReasons].slice(0, 8),
    exitMonitor,
  };
}

/** Table / strip label when an exit overlay is present. */
export function exitAwareReadinessLabel(candidate: CandidateViewModel): string {
  const mon = candidate.exitMonitor;
  if (mon?.exitSuggested) return "Exit suggested";
  if (mon?.severity === "warn") return "Exit watch";
  if (mon?.paused) return "Exit paused";
  return "";
}
