import type { DynamicRuleTemplate, RulePathVariant } from "../api/dynamic-strategy-client";

export type TimeframeFilter = "all" | "D" | "1h" | "15m";

export const TIMEFRAME_FILTERS: { id: TimeframeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "15m", label: "15M" },
  { id: "1h", label: "1H" },
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

export function inferPathFromRuleKey(ruleKey: string): "CALL" | "PUT" | null {
  if (ruleKey.endsWith("_call")) return "CALL";
  if (ruleKey.endsWith("_put")) return "PUT";
  return null;
}

export function pathVariantHint(explicit: RulePathVariant, ruleKey: string): string {
  const inferred = inferPathFromRuleKey(ruleKey);
  if (explicit === "CALL" || explicit === "PUT") return explicit;
  if (inferred) return `Auto (${inferred} from key)`;
  return "Auto";
}

export function buildRulesPayload(
  selectedRuleKeys: string[],
  rulePathVariants: Record<string, RulePathVariant>,
): Array<{ ruleKey: string; pathVariant?: "CALL" | "PUT" }> {
  return selectedRuleKeys.map((ruleKey) => {
    const path = rulePathVariants[ruleKey];
    if (path === "CALL" || path === "PUT") {
      return { ruleKey, pathVariant: path };
    }
    return { ruleKey };
  });
}

export function pathVariantsFromStrategyRules(
  rules: Array<{ ruleKey: string; pathVariant?: "CALL" | "PUT" }>,
): Record<string, RulePathVariant> {
  const out: Record<string, RulePathVariant> = {};
  for (const rule of rules) {
    if (rule.pathVariant === "CALL" || rule.pathVariant === "PUT") {
      out[rule.ruleKey] = rule.pathVariant;
    }
  }
  return out;
}
