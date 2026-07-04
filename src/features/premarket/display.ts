import type { RuleDisplayRow } from "@/features/market/types";
import { qualityBadgeClass, normalizeRuleStatus } from "@/features/market/display";
import { formatAchievedTimeEt } from "@/features/market/display";
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
  return value === "running" || value === "stopping";
}

export function canStopPremarketEvaluate(
  status: string | undefined,
  startPending: boolean,
): boolean {
  if (startPending) return true;
  return (status ?? "").toLowerCase() === "running";
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
  return rules.map((row) => ({
    ruleKey: row.ruleKey,
    label: row.label,
    type: row.type as RuleDisplayRow["type"],
    status: normalizeRuleStatus(row.status),
    metAtEt: row.metAtEt,
    evidence: row.evidence,
  }));
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
