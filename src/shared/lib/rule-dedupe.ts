/** Auto rules that detect CALL/PUT at runtime — one strategy row only. */
const AUTO_SINGLE_INSTANCE_RULE_KEYS = new Set([
  "prior_day_trend_15m",
  "candle_close_prior_15m",
]);

function baseRuleKey(ruleKey: string): string {
  return ruleKey.replace(/_call$/, "").replace(/_put$/, "");
}

export function isAutoSingleInstanceRule(ruleKey: string): boolean {
  return AUTO_SINGLE_INSTANCE_RULE_KEYS.has(baseRuleKey(ruleKey));
}

export function evalDedupeKey(rule: {
  ruleKey: string;
  trend?: "up" | "down" | "lateral";
  operation?: "call" | "put";
}): string {
  const base = baseRuleKey(rule.ruleKey);
  if (AUTO_SINGLE_INSTANCE_RULE_KEYS.has(base)) return base;
  const parts = [rule.ruleKey];
  if (rule.trend === "up" || rule.trend === "down" || rule.trend === "lateral") {
    parts.push(rule.trend);
  }
  if (rule.operation === "call" || rule.operation === "put") {
    parts.push(rule.operation);
  }
  return parts.length > 1 ? parts.join("::") : rule.ruleKey;
}
