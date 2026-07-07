import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import type { DynamicRuleTemplate, RuleOperationValue, RuleTrendValue, RuleType } from "../api/dynamic-strategy-client";
import {
  TIMEFRAME_FILTERS,
  filterRules,
  formatOperationLabel,
  formatTrendLabel,
  inferOperationFromRuleKey,
  libraryParamHint,
  normalizeTimeframe,
  operationHint,
  rowInstanceMeta,
  rowMissingRequiredFields,
  rowOperationValue,
  rowSummaryParts,
  rowTrendValue,
  ruleTypeLabel,
  trendHint,
  type BuilderRuleRow,
  type TimeframeFilter,
} from "../lib/builder-utils";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const INPUT =
  "w-full rounded-md border border-ocean-mid/40 bg-ocean-deep px-3 py-2 text-sm text-ocean-foam placeholder:text-ocean-sand/50 focus:border-ocean-teal/50 focus:outline-none";

const SELECT =
  "w-full rounded-md border border-ocean-mid/40 bg-ocean-deep px-2 py-1.5 text-xs text-ocean-foam focus:border-ocean-teal/50 focus:outline-none";

const FIELD_LABEL = "mb-1 block text-[10px] font-medium uppercase tracking-wide text-ocean-sand/90";

type Props = {
  layout?: "modal" | "page";
  rules: DynamicRuleTemplate[];
  builderRows: BuilderRuleRow[];
  name: string;
  shortName: string;
  description: string;
  editingStrategyId: string | null;
  saving: boolean;
  startPending: boolean;
  error?: string | null;
  onNameChange: (value: string) => void;
  onShortNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTrendChange: (rowId: string, trend: RuleTrendValue) => void;
  onOperationChange: (rowId: string, operation: RuleOperationValue) => void;
  onRuleTypeChange: (rowId: string, ruleType: RuleType) => void;
  onAddRule: (ruleKey: string) => void;
  onRemoveRule: (rowId: string) => void;
  onMoveRule: (rowId: string, direction: "up" | "down") => void;
  onCancel: () => void;
  onSave: () => void;
  onPreview: () => void;
  onDelete?: () => void;
};

function SummaryChip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "call" | "put" | "warn" }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
        tone === "call" && "bg-emerald-500/15 text-emerald-300",
        tone === "put" && "bg-amber-500/15 text-amber-200",
        tone === "warn" && "bg-ocean-danger/15 text-ocean-danger",
        tone === "neutral" && "bg-ocean-mid/35 text-ocean-sand",
      )}
    >
      {children}
    </span>
  );
}

function BuilderRuleRowCard({
  row,
  template,
  rowNumber,
  instance,
  onTrendChange,
  onOperationChange,
  onRuleTypeChange,
  onRemoveRule,
  onMoveRule,
  isFirst,
  isLast,
}: {
  row: BuilderRuleRow;
  template: DynamicRuleTemplate & { ruleKey: string; label: string };
  rowNumber: number;
  instance: { index: number; total: number };
  onTrendChange: (rowId: string, trend: RuleTrendValue) => void;
  onOperationChange: (rowId: string, operation: RuleOperationValue) => void;
  onRuleTypeChange: (rowId: string, ruleType: RuleType) => void;
  onRemoveRule: (rowId: string) => void;
  onMoveRule: (rowId: string, direction: "up" | "down") => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const explicitTrend = rowTrendValue(row);
  const explicitOperation = rowOperationValue(row);
  const inferredOp = inferOperationFromRuleKey(row.ruleKey);
  const showTrend = template.trend === "set" || template.trend === "auto";
  const showOperation = template.operation === "set" || template.operation === "auto";
  const missing = rowMissingRequiredFields(row, template);
  const summaryParts = rowSummaryParts(row, template);

  const operationTone =
    row.operation === "call" ? "call" : row.operation === "put" ? "put" : "neutral";

  return (
    <li
      className={cn(
        "rounded-lg border bg-ocean-deep/40",
        missing.length > 0 ? "border-amber-500/40" : "border-ocean-mid/35",
      )}
    >
      <div className="flex items-start gap-2 border-b border-ocean-mid/25 px-3 py-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ocean-mid/40 text-[10px] font-bold tabular-nums text-ocean-foam"
          title={`Row ${rowNumber}`}
        >
          {rowNumber}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-xs font-semibold text-ocean-foam">{template.label}</span>
            {template.timeframe && (
              <span className="text-[10px] text-ocean-sand/70">{normalizeTimeframe(template.timeframe)}</span>
            )}
            {instance.total > 1 && (
              <span className="rounded bg-ocean-teal/15 px-1.5 py-px text-[10px] font-medium text-ocean-teal">
                Instance {instance.index} of {instance.total}
              </span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-ocean-sand/55">{row.ruleKey}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {summaryParts.map((part) => (
              <SummaryChip
                key={part}
                tone={
                  part === "CALL" ? "call" : part === "PUT" ? "put" : "neutral"
                }
              >
                {part}
              </SummaryChip>
            ))}
            {missing.map((field) => (
              <SummaryChip key={field} tone="warn">
                Set {field}
              </SummaryChip>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <button
            type="button"
            title="Move row up"
            disabled={isFirst}
            onClick={() => onMoveRule(row.id, "up")}
            className="rounded px-1.5 py-0.5 text-ocean-sand hover:bg-ocean-mid/40 disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            title="Move row down"
            disabled={isLast}
            onClick={() => onMoveRule(row.id, "down")}
            className="rounded px-1.5 py-0.5 text-ocean-sand hover:bg-ocean-mid/40 disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            title="Remove this row"
            onClick={() => onRemoveRule(row.id)}
            className="rounded px-1.5 py-0.5 text-ocean-danger hover:bg-ocean-danger/10"
          >
            ×
          </button>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-3 px-3 py-2.5",
          showTrend && showOperation ? "sm:grid-cols-3" : showTrend || showOperation ? "sm:grid-cols-2" : "sm:grid-cols-1",
        )}
      >
        <label className="block min-w-0">
          <span className={FIELD_LABEL}>Role</span>
          <select
            value={row.type}
            onChange={(e) => onRuleTypeChange(row.id, e.target.value as RuleType)}
            className={SELECT}
          >
            <option value="required">Required — counts toward score</option>
            <option value="extra">Extra — evaluated, optional</option>
            <option value="gate">Gate — must pass to qualify</option>
          </select>
        </label>

        {showTrend && (
          <label className="block min-w-0">
            <span className={FIELD_LABEL}>
              Trend {template.trend === "set" ? "(required)" : "(optional)"}
            </span>
            <select
              value={explicitTrend}
              onChange={(e) => onTrendChange(row.id, e.target.value as RuleTrendValue)}
              className={cn(SELECT, missing.includes("trend") && "border-amber-500/50")}
              title={trendHint(explicitTrend, template)}
            >
              <option value="">
                {template.defaultTrend
                  ? `Auto — ${formatTrendLabel(template.defaultTrend)}`
                  : "Auto — from market"}
              </option>
              <option value="up">Up — bullish / alcista</option>
              <option value="down">Down — bearish / bajista</option>
              <option value="lateral">Lateral — sideways</option>
            </select>
          </label>
        )}

        {showOperation && (
          <label className="block min-w-0">
            <span className={FIELD_LABEL}>
              Operation {template.operation === "set" ? "(required)" : "(optional)"}
            </span>
            <select
              value={explicitOperation}
              onChange={(e) => onOperationChange(row.id, e.target.value as RuleOperationValue)}
              className={cn(SELECT, missing.includes("operation") && "border-amber-500/50")}
              title={operationHint(explicitOperation, row.ruleKey)}
            >
              <option value="">
                {inferredOp ? `Auto — ${formatOperationLabel(inferredOp)}` : "Auto — from market"}
              </option>
              <option value="call">CALL</option>
              <option value="put">PUT</option>
            </select>
            {row.operation && (
              <span className={cn("mt-1 inline-block text-[10px]", operationTone === "call" ? "text-emerald-300/80" : "text-amber-200/80")}>
                Trade path for this row: {formatOperationLabel(row.operation)}
              </span>
            )}
          </label>
        )}

        {!showTrend && !showOperation && (
          <p className="text-[11px] leading-relaxed text-ocean-sand/80 sm:col-span-full">
            This rule does not use row-level trend or operation — direction is inferred at evaluate time
            from the rule itself or market context.
          </p>
        )}
      </div>
    </li>
  );
}

export function DynamicStrategyBuilder({
  layout = "modal",
  rules,
  builderRows,
  name,
  shortName,
  description,
  editingStrategyId,
  saving,
  startPending,
  error,
  onNameChange,
  onShortNameChange,
  onDescriptionChange,
  onTrendChange,
  onOperationChange,
  onRuleTypeChange,
  onAddRule,
  onRemoveRule,
  onMoveRule,
  onCancel,
  onSave,
  onPreview,
  onDelete,
}: Props) {
  const [search, setSearch] = useState("");
  const [timeframe, setTimeframe] = useState<TimeframeFilter>("all");

  const ruleMap = useMemo(
    () => new Map(rules.map((r) => [r.ruleKey, r])),
    [rules],
  );

  const filteredLibrary = useMemo(
    () => filterRules(rules, { search, timeframe }),
    [rules, search, timeframe],
  );

  const composedRules = useMemo(
    () =>
      builderRows.map((row) => {
        const template = ruleMap.get(row.ruleKey);
        if (template) return { row, template };
        return {
          row,
          template: {
            ruleKey: row.ruleKey,
            label: `${row.ruleKey} (not in library)`,
            defaultType: "required" as const,
          },
        };
      }),
    [builderRows, ruleMap],
  );

  const ruleKeyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of builderRows) {
      counts.set(row.ruleKey, (counts.get(row.ruleKey) ?? 0) + 1);
    }
    return counts;
  }, [builderRows]);

  const instanceMeta = useMemo(() => rowInstanceMeta(builderRows), [builderRows]);

  const incompleteRows = useMemo(
    () =>
      composedRules.filter(({ row, template }) =>
        rowMissingRequiredFields(row, template).length > 0,
      ).length,
    [composedRules],
  );

  const canSave = name.trim().length > 0 && builderRows.length > 0;
  const isEditing = editingStrategyId != null;
  const isPage = layout === "page";
  const libraryMaxHeight = isPage ? "max-h-[min(42rem,70vh)]" : "max-h-72";
  const rowsMaxHeight = isPage ? "max-h-[min(42rem,70vh)]" : "max-h-[min(24rem,50vh)]";

  return (
    <div
      className={cn(
        "grid gap-0 divide-y divide-ocean-mid/30 lg:grid-cols-2 lg:divide-x lg:divide-y-0",
        isPage && "min-h-[min(48rem,80vh)]",
      )}
    >
      {error && (
        <p className="col-span-full border-b border-ocean-danger/30 bg-ocean-danger/10 px-4 py-2 text-sm text-ocean-danger" role="alert">
          {error}
        </p>
      )}

      <div className="p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ocean-sand">
          Rule library
        </h3>
        <p className="mt-1 text-[11px] leading-relaxed text-ocean-sand/85">
          Click <span className="text-ocean-teal">Add row</span> to place a rule in your strategy.
          Click again for the same rule — each row can have its own trend and operation (e.g. E01 CALL vs PUT path).
        </p>
        <input
          type="search"
          placeholder="Search rules…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn(INPUT, "mt-2")}
          aria-label="Search rules"
        />
        <div className="mt-2 flex flex-wrap gap-1">
          {TIMEFRAME_FILTERS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTimeframe(tab.id)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                timeframe === tab.id
                  ? "bg-ocean-teal text-ocean-deep"
                  : "bg-ocean-mid/30 text-ocean-sand hover:bg-ocean-mid/50",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <ul className={cn("mt-3 space-y-1.5 overflow-y-auto pr-1", libraryMaxHeight)}>
          {filteredLibrary.map((rule) => {
            const inStrategy = ruleKeyCounts.get(rule.ruleKey) ?? 0;
            const paramHint = libraryParamHint(rule);
            return (
              <li key={rule.ruleKey}>
                <button
                  type="button"
                  onClick={() => onAddRule(rule.ruleKey)}
                  className="group flex w-full items-start gap-2 rounded-lg border border-ocean-mid/30 px-2.5 py-2 text-left text-xs transition-colors hover:border-ocean-teal/50 hover:bg-ocean-deep/50"
                >
                  <span className="mt-0.5 rounded bg-ocean-teal/15 px-1.5 py-0.5 text-[10px] font-semibold text-ocean-teal group-hover:bg-ocean-teal/25">
                    + Add row
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-ocean-foam">{rule.label}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-ocean-sand">
                      {rule.timeframe && (
                        <span className="rounded bg-ocean-mid/40 px-1 py-px">
                          {normalizeTimeframe(rule.timeframe)}
                        </span>
                      )}
                      <span className="rounded bg-ocean-mid/40 px-1 py-px">
                        Default {ruleTypeLabel(rule.defaultType)}
                      </span>
                      {paramHint && (
                        <span className="rounded bg-ocean-mid/25 px-1 py-px text-ocean-sand/90">
                          {paramHint}
                        </span>
                      )}
                      {inStrategy > 0 && (
                        <span className="rounded bg-ocean-teal/20 px-1 py-px font-medium text-ocean-teal">
                          {inStrategy} row{inStrategy === 1 ? "" : "s"} in strategy
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {filteredLibrary.length === 0 && (
            <li className="py-4 text-center text-xs text-ocean-sand">No rules match.</li>
          )}
        </ul>
      </div>

      <div className="p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ocean-sand">
          Your strategy
          {isEditing && (
            <span className="ml-2 normal-case font-normal text-ocean-teal">· editing</span>
          )}
        </h3>

        <div className="mt-2 space-y-2">
          <label className="block">
            <span className="text-[11px] text-ocean-sand">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Hourly trend change"
              className={cn(INPUT, "mt-0.5")}
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-ocean-sand">Short name (optional)</span>
            <input
              type="text"
              value={shortName}
              onChange={(e) => onShortNameChange(e.target.value)}
              placeholder="Shown in compact lists"
              className={cn(INPUT, "mt-0.5")}
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-ocean-sand">Description (optional)</span>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              rows={2}
              placeholder="What this screen looks for…"
              className={cn(INPUT, "mt-0.5 resize-none")}
            />
          </label>
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[11px] font-medium text-ocean-sand">
              Rule rows ({composedRules.length})
            </p>
            {incompleteRows > 0 && (
              <p className="text-[10px] text-amber-200/90">
                {incompleteRows} row{incompleteRows === 1 ? "" : "s"} need trend or operation
              </p>
            )}
          </div>

          {composedRules.length === 0 ? (
            <div className="mt-2 rounded-lg border border-dashed border-ocean-mid/40 bg-ocean-deep/20 px-3 py-5 text-xs text-ocean-sand">
              <p className="font-medium text-ocean-foam">No rows yet</p>
              <p className="mt-1 leading-relaxed">
                Pick rules from the library. Each click creates a <strong className="font-medium text-ocean-foam">new row</strong> —
                not a checkbox. Dual-path strategies (like E01) use two rows for the same rule with different settings.
              </p>
              <p className="mt-2 rounded-md bg-ocean-mid/20 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-ocean-sand/90">
                Row A: prior BB · trend Down · operation CALL<br />
                Row B: prior BB · trend Up · operation PUT
              </p>
            </div>
          ) : (
            <ol className={cn("mt-2 space-y-2 overflow-y-auto pr-0.5", rowsMaxHeight)}>
              {composedRules.map(({ row, template }, index) => (
                <BuilderRuleRowCard
                  key={row.id}
                  row={row}
                  template={template}
                  rowNumber={index + 1}
                  instance={instanceMeta.get(row.id) ?? { index: 1, total: 1 }}
                  onTrendChange={onTrendChange}
                  onOperationChange={onOperationChange}
                  onRuleTypeChange={onRuleTypeChange}
                  onRemoveRule={onRemoveRule}
                  onMoveRule={onMoveRule}
                  isFirst={index === 0}
                  isLast={index === composedRules.length - 1}
                />
              ))}
            </ol>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-ocean-mid/30 pt-4">
          <button
            type="button"
            className={cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-105")}
            disabled={saving || !canSave}
            onClick={onSave}
          >
            {saving ? "Saving…" : isEditing ? "Update strategy" : "Save strategy"}
          </button>
          <button
            type="button"
            className={cn(
              BTN,
              "border border-ocean-mid/60 bg-ocean-deep text-ocean-foam hover:border-ocean-teal/50",
            )}
            disabled={startPending || builderRows.length === 0}
            onClick={onPreview}
          >
            {startPending ? "Running…" : "Preview on tickers"}
          </button>
          <button
            type="button"
            className={cn(BTN, "text-ocean-sand hover:text-ocean-foam")}
            disabled={saving}
            onClick={onCancel}
          >
            Cancel
          </button>
          {isEditing && onDelete ? (
            <button
              type="button"
              className={cn(
                BTN,
                "ml-auto border border-ocean-danger/40 text-ocean-danger hover:bg-ocean-danger/10",
              )}
              disabled={saving}
              onClick={onDelete}
            >
              Delete strategy
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
