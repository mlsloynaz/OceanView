import type { DynamicRuleTemplate } from "../api/dynamic-strategy-client";

export type TimeframeFilter = "all" | "D" | "1h" | "15m";

export const TIMEFRAME_FILTERS: { id: TimeframeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "1h", label: "1H" },
  { id: "15m", label: "15M" },
  { id: "D", label: "Daily" },
];

export function normalizeTimeframe(tf: string | undefined): string {
  const raw = (tf ?? "").trim().toLowerCase();
  if (raw === "d" || raw === "daily") return "D";
  if (raw === "1h" || raw === "hourly") return "1h";
  if (raw === "15m" || raw === "min15") return "15m";
  return tf ?? "";
}

export function filterRules(
  rules: DynamicRuleTemplate[],
  options: { search: string; timeframe: TimeframeFilter },
): DynamicRuleTemplate[] {
  const { search, timeframe } = options;
  const q = search.trim().toLowerCase();
  return rules.filter((rule) => {
    if (timeframe !== "all") {
      const ruleTf = normalizeTimeframe(rule.timeframe);
      if (ruleTf !== timeframe) return false;
    }
    if (!q) return true;
    return (
      rule.ruleKey.toLowerCase().includes(q) ||
      rule.label.toLowerCase().includes(q) ||
      (rule.timeframe ?? "").toLowerCase().includes(q)
    );
  });
}

export function ruleTypeLabel(type: string | undefined): string {
  const t = (type ?? "required").toLowerCase();
  if (t === "extra") return "Extra";
  if (t === "gate") return "Gate";
  return "Required";
}
