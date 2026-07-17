import type { RuleDisplayRow } from "@/features/market/types";
import { qualityBadgeClass, normalizeRuleStatus } from "@/features/market/display";
import { formatAchievedTimeEt } from "@/features/market/display";
import { evalDedupeKey } from "@/shared/lib/rule-dedupe";
import type { PremarketRuleRow } from "./types";

export { qualityBadgeClass, formatAchievedTimeEt };

export function formatPremarketStatus(status: string | undefined): string {
  if (!status) return "Unknown";
  switch (status.toLowerCase()) {
    case "complete":
      return "Complete";
    case "partial":
      return "Partial";
    case "stopped":
      return "Stopped";
    case "failed":
      return "Failed";
    case "running":
      return "Running";
    case "ready":
      return "Early results";
    case "stopping":
      return "Stopping";
    case "idle":
      return "Idle";
    default:
      return status;
  }
}

export function isPremarketEvaluateActive(status: string | undefined): boolean {
  const value = (status ?? "").toLowerCase();
  return value === "running" || value === "ready" || value === "stopping";
}

export function isPremarketEvaluateTerminal(status: string | undefined): boolean {
  const value = (status ?? "").toLowerCase();
  return value === "complete" || value === "partial" || value === "failed" || value === "stopped";
}

export function canStopPremarketEvaluate(
  status: string | undefined,
  startPending: boolean,
  canStopFromApi?: boolean,
): boolean {
  if (startPending) return true;
  if (canStopFromApi === true) return true;
  if (canStopFromApi === false) return false;
  return isPremarketEvaluateActive(status);
}

export function formatSimTimeEt(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "shortGeneric",
    });
  } catch {
    return iso;
  }
}

export function toPremarketDisplayRules(
  rules: PremarketRuleRow[] | undefined,
): RuleDisplayRow[] {
  if (!rules?.length) return [];
  const seen = new Set<string>();
  const rows: RuleDisplayRow[] = [];
  for (const row of rules) {
    const dedupeKey = evalDedupeKey({
      ruleKey: row.ruleKey,
      trend: row.trend,
      operation: row.operation,
    });
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    rows.push({
      ruleKey: row.ruleKey,
      label: row.label,
      type: row.type as RuleDisplayRow["type"],
      status: normalizeRuleStatus(row.status),
      metAtEt: row.metAtEt,
      evidence: row.evidence,
      suggestedTrend: row.suggestedTrend,
      suggestedDirection: row.suggestedDirection,
    });
  }
  return rows;
}

export function strategyGroupSubtitle(
  strategyId: string,
  tickerCount: number,
  threshold: number,
): string {
  const countLabel = `${tickerCount} ticker${tickerCount === 1 ? "" : "s"}`;
  if (threshold > 0) {
    return `${strategyId} · ${countLabel} ≥ ${threshold}%`;
  }
  return `${strategyId} · ${countLabel}`;
}
