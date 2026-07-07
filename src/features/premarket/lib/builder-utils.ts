import type {
  DynamicRuleTemplate,
  DynamicStrategyRule,
  DynamicStrategyRuleInput,
  RuleOperationValue,
  RuleTrendValue,
  RuleType,
} from "../api/dynamic-strategy-client";

export type TimeframeFilter = "all" | "D" | "1h" | "15m";

/** One composed rule row in the strategy builder (unique id per instance). */
export type BuilderRuleRow = {
  id: string;
  ruleKey: string;
  type: RuleType;
  trend?: "up" | "down" | "lateral";
  operation?: "call" | "put";
};

export const TIMEFRAME_FILTERS: { id: TimeframeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "15m", label: "15M" },
  { id: "1h", label: "1H" },
  { id: "D", label: "Daily" },
];

export function newBuilderRowId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `row-${crypto.randomUUID()}`;
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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

export function normalizeRuleType(type: string | undefined): RuleType {
  const t = (type ?? "required").toLowerCase();
  if (t === "extra" || t === "gate") return t;
  return "required";
}

export function inferOperationFromRuleKey(ruleKey: string): "call" | "put" | null {
  if (ruleKey.endsWith("_call")) return "call";
  if (ruleKey.endsWith("_put")) return "put";
  return null;
}

export function operationFromLegacyPath(path: "CALL" | "PUT" | undefined): RuleOperationValue {
  if (path === "CALL") return "call";
  if (path === "PUT") return "put";
  return "";
}

export function trendFromStrategyRule(rule: {
  trend?: "up" | "down" | "lateral";
  requiredPriorRegime?: string;
}): "up" | "down" | "lateral" | undefined {
  if (rule.trend === "up" || rule.trend === "down" || rule.trend === "lateral") {
    return rule.trend;
  }
  const regime = (rule.requiredPriorRegime ?? "").toLowerCase();
  if (regime === "alcista") return "up";
  if (regime === "bajista") return "down";
  return undefined;
}

export function operationFromStrategyRule(rule: {
  operation?: "call" | "put";
  pathVariant?: "CALL" | "PUT";
}): "call" | "put" | undefined {
  if (rule.operation === "call" || rule.operation === "put") {
    return rule.operation;
  }
  const legacy = operationFromLegacyPath(rule.pathVariant);
  return legacy === "call" || legacy === "put" ? legacy : undefined;
}

export function builderRowsFromStrategyRules(rules: DynamicStrategyRule[]): BuilderRuleRow[] {
  return rules.map((rule, index) => {
    const trend = trendFromStrategyRule(rule);
    const operation = operationFromStrategyRule(rule);
    return {
      id: rule.id?.trim() || `row-${index}-${rule.ruleKey}`,
      ruleKey: rule.ruleKey,
      type: normalizeRuleType(rule.type),
      ...(trend ? { trend } : {}),
      ...(operation ? { operation } : {}),
    };
  });
}

export function newBuilderRow(
  ruleKey: string,
  template: DynamicRuleTemplate | undefined,
): BuilderRuleRow {
  return {
    id: newBuilderRowId(),
    ruleKey,
    type: normalizeRuleType(template?.defaultType),
    ...(template?.defaultTrend ? { trend: template.defaultTrend } : {}),
  };
}

export function trendHint(
  explicit: RuleTrendValue,
  template: DynamicRuleTemplate | undefined,
): string {
  if (explicit === "up" || explicit === "down" || explicit === "lateral") return explicit;
  if (template?.defaultTrend) return `Auto (${template.defaultTrend})`;
  if (template?.trend === "auto") return "Auto (from market)";
  return "Auto";
}

export function operationHint(explicit: RuleOperationValue, ruleKey: string): string {
  const inferred = inferOperationFromRuleKey(ruleKey);
  if (explicit === "call" || explicit === "put") return explicit;
  if (inferred) return `Auto (${inferred} from key)`;
  return "Auto";
}

export function rowTrendValue(row: BuilderRuleRow): RuleTrendValue {
  return row.trend ?? "";
}

export function rowOperationValue(row: BuilderRuleRow): RuleOperationValue {
  return row.operation ?? "";
}

export function buildRulesPayload(rows: BuilderRuleRow[]): DynamicStrategyRuleInput[] {
  return rows.map((row) => {
    const item: DynamicStrategyRuleInput = {
      id: row.id,
      ruleKey: row.ruleKey,
      type: row.type,
    };
    if (row.trend === "up" || row.trend === "down" || row.trend === "lateral") {
      item.trend = row.trend;
    }
    if (row.operation === "call" || row.operation === "put") {
      item.operation = row.operation;
    }
    return item;
  });
}

export function setRowTrend(rows: BuilderRuleRow[], rowId: string, trend: RuleTrendValue): BuilderRuleRow[] {
  return rows.map((row) => {
    if (row.id !== rowId) return row;
    if (trend === "up" || trend === "down" || trend === "lateral") {
      return { ...row, trend };
    }
    const { trend: _removed, ...rest } = row;
    return rest;
  });
}

export function setRowOperation(
  rows: BuilderRuleRow[],
  rowId: string,
  operation: RuleOperationValue,
): BuilderRuleRow[] {
  return rows.map((row) => {
    if (row.id !== rowId) return row;
    if (operation === "call" || operation === "put") {
      return { ...row, operation };
    }
    const { operation: _removed, ...rest } = row;
    return rest;
  });
}

export function setRowType(rows: BuilderRuleRow[], rowId: string, type: RuleType): BuilderRuleRow[] {
  return rows.map((row) => (row.id === rowId ? { ...row, type } : row));
}

export function removeBuilderRow(rows: BuilderRuleRow[], rowId: string): BuilderRuleRow[] {
  return rows.filter((row) => row.id !== rowId);
}

export function moveBuilderRow(
  rows: BuilderRuleRow[],
  rowId: string,
  direction: "up" | "down",
): BuilderRuleRow[] {
  const index = rows.findIndex((row) => row.id === rowId);
  if (index < 0) return rows;
  const swap = direction === "up" ? index - 1 : index + 1;
  if (swap < 0 || swap >= rows.length) return rows;
  const next = [...rows];
  [next[index], next[swap]] = [next[swap], next[index]];
  return next;
}

type RuleTemplateShape = Pick<DynamicRuleTemplate, "trend" | "operation" | "defaultTrend">;

export function formatTrendLabel(trend: RuleTrendValue | BuilderRuleRow["trend"]): string {
  if (trend === "up") return "Up";
  if (trend === "down") return "Down";
  if (trend === "lateral") return "Lateral";
  return "Auto";
}

export function formatOperationLabel(
  operation: RuleOperationValue | BuilderRuleRow["operation"],
): string {
  if (operation === "call") return "CALL";
  if (operation === "put") return "PUT";
  return "Auto";
}

/** Per-row index among rows sharing the same ruleKey (1-based). */
export function rowInstanceMeta(rows: BuilderRuleRow[]): Map<string, { index: number; total: number }> {
  const idsByKey = new Map<string, string[]>();
  for (const row of rows) {
    const list = idsByKey.get(row.ruleKey) ?? [];
    list.push(row.id);
    idsByKey.set(row.ruleKey, list);
  }
  const meta = new Map<string, { index: number; total: number }>();
  for (const ids of idsByKey.values()) {
    ids.forEach((id, i) => meta.set(id, { index: i + 1, total: ids.length }));
  }
  return meta;
}

export function rowMissingRequiredFields(
  row: BuilderRuleRow,
  template: RuleTemplateShape,
): Array<"trend" | "operation"> {
  const missing: Array<"trend" | "operation"> = [];
  if (template.trend === "set" && !row.trend) missing.push("trend");
  if (template.operation === "set" && !row.operation) missing.push("operation");
  return missing;
}

export function rowSummaryParts(
  row: BuilderRuleRow,
  template: RuleTemplateShape,
): string[] {
  const parts = [ruleTypeLabel(row.type)];
  if (template.trend === "set" || template.trend === "auto") {
    parts.push(
      row.trend
        ? `${formatTrendLabel(row.trend)} trend`
        : template.defaultTrend
          ? `Auto ${formatTrendLabel(template.defaultTrend)} trend`
          : "Trend: auto",
    );
  }
  if (template.operation === "set" || template.operation === "auto") {
    parts.push(row.operation ? formatOperationLabel(row.operation) : "Operation: auto");
  }
  return parts;
}

export function libraryParamHint(template: DynamicRuleTemplate): string | null {
  const bits: string[] = [];
  if (template.trend === "set") bits.push("trend required");
  else if (template.trend === "auto") bits.push("trend optional");
  if (template.operation === "set") bits.push("operation required");
  else if (template.operation === "auto") bits.push("operation optional");
  return bits.length ? bits.join(" · ") : null;
}

