import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import type { DynamicRuleTemplate, DynamicStrategy, RuleOperationValue, RuleTrendValue, RuleType } from "../api/dynamic-strategy-client";
import {
  TIMEFRAME_FILTERS,
  biasRuleOptionLabel,
  builderPathStats,
  filterRules,
  formatOperationLabel,
  formatTrendLabelFriendly,
  inferOperationFromRuleKey,
  libraryParamHint,
  normalizeTimeframe,
  operationHint,
  rowInstanceMeta,
  rowMatchesPathFilter,
  rowMissingRequiredFields,
  rowOperationValue,
  rowSummaryFriendly,
  rowTrendValue,
  ruleTypeLabel,
  trendHint,
  type BuilderRuleRow,
  type PathFilter,
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
  strategyId: string;
  entryStartEt: string;
  entryEndEt: string;
  entryLegacyLabel?: string | null;
  /** Selected rule row id that sets strategy CALL/PUT bias. */
  biasRuleId?: string;
  editingStrategyId: string | null;
  templateStrategies?: DynamicStrategy[];
  saving: boolean;
  startPending: boolean;
  error?: string | null;
  onNameChange: (value: string) => void;
  onStrategyIdChange: (value: string) => void;
  onEntryStartChange: (value: string) => void;
  onEntryEndChange: (value: string) => void;
  onBiasRuleIdChange?: (rowId: string) => void;
  onCloneFrom?: (strategy: DynamicStrategy) => void;
  onTrendChange: (rowId: string, trend: RuleTrendValue) => void;
  onOperationChange: (rowId: string, operation: RuleOperationValue) => void;
  onRuleTypeChange: (rowId: string, ruleType: RuleType) => void;
  onAddRule: (ruleKey: string) => void;
  onRemoveRule: (rowId: string) => void;
  onMoveRule: (rowId: string, direction: "up" | "down") => void;
  onCancel: () => void;
  onSave: () => void;
  onSaveAll?: () => void;
  hasUnsavedChanges?: boolean;
  dirtyCount?: number;
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
  expanded,
  isBiasRule,
  onToggleExpand,
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
  expanded: boolean;
  isBiasRule: boolean;
  onToggleExpand: () => void;
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
  const summary = rowSummaryFriendly(row, template, { isBiasRule });

  const operationTone =
    row.operation === "call" ? "call" : row.operation === "put" ? "put" : "neutral";

  return (
    <li
      id={`builder-row-${row.id}`}
      className={cn(
        "rounded-lg border bg-ocean-deep/40",
        missing.length > 0 ? "border-amber-500/40" : "border-ocean-mid/35",
      )}
    >
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
      >
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
            {row.operation === "call" && <SummaryChip tone="call">CALL</SummaryChip>}
            {row.operation === "put" && <SummaryChip tone="put">PUT</SummaryChip>}
            {isBiasRule && <SummaryChip tone="neutral">Sets bias</SummaryChip>}
            {instance.total > 1 && (
              <span className="rounded bg-ocean-teal/15 px-1.5 py-px text-[10px] font-medium text-ocean-teal">
                {instance.index}/{instance.total}
              </span>
            )}
          </div>
          <p
            className="mt-0.5 font-mono text-[10px] leading-snug text-ocean-sand/50"
            title="Evaluator ruleKey (code)"
          >
            {row.ruleKey}
          </p>
          <p className="mt-1 text-[11px] text-ocean-sand/85">{summary}</p>
          {missing.length > 0 && !expanded && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {missing.includes("operation") && (
                <>
                  <SummaryChip tone="warn">Set direction</SummaryChip>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOperationChange(row.id, "call");
                    }}
                    className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/25"
                  >
                    CALL
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOperationChange(row.id, "put");
                    }}
                    className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-200 hover:bg-amber-500/25"
                  >
                    PUT
                  </button>
                </>
              )}
              {missing.includes("trend") && (
                <SummaryChip tone="warn">Set market bias</SummaryChip>
              )}
            </div>
          )}
        </div>
        <span className="shrink-0 text-[10px] text-ocean-sand/70">{expanded ? "▴" : "▾"}</span>
      </button>

      {expanded && (
        <>
          <div className="flex justify-end gap-0.5 border-t border-ocean-mid/25 px-2 py-1">
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
              Remove
            </button>
          </div>

          <div
            className={cn(
              "grid gap-3 border-t border-ocean-mid/25 px-3 py-2.5",
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
                <option value="required">Must pass — counts toward score</option>
                <option value="extra">Bonus — optional signal</option>
                <option value="gate">Blocker — must pass to qualify</option>
              </select>
            </label>

            {showTrend && (
              <label className="block min-w-0">
                <span className={FIELD_LABEL}>
                  Market bias {template.trend === "set" ? "(required)" : "(optional)"}
                </span>
                <select
                  value={explicitTrend}
                  onChange={(e) => onTrendChange(row.id, e.target.value as RuleTrendValue)}
                  className={cn(SELECT, missing.includes("trend") && "border-amber-500/50")}
                  title={trendHint(explicitTrend, template)}
                >
                  <option value="">
                    {template.defaultTrend
                      ? `Auto — ${formatTrendLabelFriendly(template.defaultTrend)}`
                      : "Auto — from market"}
                  </option>
                  <option value="up">Alcista (up)</option>
                  <option value="down">Bajista (down)</option>
                  <option value="lateral">Lateral (sideways)</option>
                </select>
              </label>
            )}

            {showOperation && (
              <label className="block min-w-0">
                <span className={FIELD_LABEL}>
                  Trade direction {template.operation === "set" ? "(required)" : "(optional)"}
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
                  <span
                    className={cn(
                      "mt-1 inline-block text-[10px]",
                      operationTone === "call" ? "text-emerald-300/80" : "text-amber-200/80",
                    )}
                  >
                    Path for this row: {formatOperationLabel(row.operation)}
                  </span>
                )}
              </label>
            )}

            {!showTrend && !showOperation && (
              <p className="text-[11px] leading-relaxed text-ocean-sand/80 sm:col-span-full">
                This rule infers direction at evaluate time — no row-level bias or trade path.
              </p>
            )}
          </div>
        </>
      )}
    </li>
  );
}

export function DynamicStrategyBuilder({
  layout = "modal",
  rules,
  builderRows,
  name,
  strategyId,
  entryStartEt,
  entryEndEt,
  entryLegacyLabel = null,
  biasRuleId = "",
  editingStrategyId,
  templateStrategies = [],
  saving,
  startPending,
  error,
  onNameChange,
  onStrategyIdChange,
  onEntryStartChange,
  onEntryEndChange,
  onBiasRuleIdChange,
  onCloneFrom,
  onTrendChange,
  onOperationChange,
  onRuleTypeChange,
  onAddRule,
  onRemoveRule,
  onMoveRule,
  onCancel,
  onSave,
  onSaveAll,
  hasUnsavedChanges = false,
  dirtyCount = 0,
  onPreview,
  onDelete,
}: Props) {
  const [search, setSearch] = useState("");
  const [timeframe, setTimeframe] = useState<TimeframeFilter>("all");
  const [pathFilter, setPathFilter] = useState<PathFilter>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set());
  const [cloneSourceId, setCloneSourceId] = useState("");
  const prevRowCountRef = useRef(builderRows.length);

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

  const pathStats = useMemo(() => builderPathStats(builderRows), [builderRows]);

  const incompleteRows = useMemo(
    () =>
      composedRules.filter(({ row, template }) =>
        rowMissingRequiredFields(row, template).length > 0,
      ),
    [composedRules],
  );

  const filteredComposedRules = useMemo(
    () => composedRules.filter(({ row }) => rowMatchesPathFilter(row, pathFilter)),
    [composedRules, pathFilter],
  );

  useEffect(() => {
    if (builderRows.length > prevRowCountRef.current) {
      const added = builderRows.slice(prevRowCountRef.current);
      setExpandedRows((prev) => {
        const next = new Set(prev);
        for (const row of added) next.add(row.id);
        return next;
      });
    }
    prevRowCountRef.current = builderRows.length;
  }, [builderRows]);

  useEffect(() => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      for (const { row } of incompleteRows) next.add(row.id);
      return next;
    });
  }, [incompleteRows]);

  const toggleRowExpanded = (rowId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const scrollToFirstIncomplete = () => {
    const first = incompleteRows[0];
    if (!first) return;
    setExpandedRows((prev) => new Set(prev).add(first.row.id));
    document.getElementById(`builder-row-${first.row.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const handleCloneApply = () => {
    const source = templateStrategies.find((s) => s.id === cloneSourceId);
    if (source && onCloneFrom) onCloneFrom(source);
  };

  const isEditing = editingStrategyId != null;
  const canSave =
    name.trim().length > 0 &&
    builderRows.length > 0 &&
    (isEditing || strategyId.trim().length > 0);
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
          Click <span className="text-ocean-teal">Add row</span> to add a rule. Use path tabs on the right
          to focus CALL or PUT rows.
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
                    <span
                      className="mt-0.5 block font-mono text-[10px] leading-snug text-ocean-sand/50"
                      title="Evaluator ruleKey (code)"
                    >
                      {rule.ruleKey}
                    </span>
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

      <div className="flex flex-col p-4">
        <div className="rounded-lg border border-ocean-mid/35 bg-ocean-deep/30 px-3 py-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] text-ocean-sand">ID</span>
              <input
                type="text"
                value={strategyId}
                onChange={(e) => onStrategyIdChange(e.target.value)}
                placeholder="e.g. hourly-trend-change"
                autoComplete="off"
                spellCheck={false}
                className={cn(INPUT, "mt-0.5 font-mono")}
              />
              <p className="mt-1 text-[10px] leading-relaxed text-ocean-sand/80">
                {isEditing
                  ? "Editable for standard and dynamic. Changing the ID renames the strategy in Dynamo on Save all."
                  : "Required. Letters, digits, '.', '_', '-' (1–64 chars)."}
                {isEditing && editingStrategyId && editingStrategyId !== strategyId.trim() ? (
                  <>
                    {" "}
                    Current Dynamo id:{" "}
                    <span className="font-mono text-ocean-sand">{editingStrategyId}</span>
                  </>
                ) : null}
              </p>
            </label>
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
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] text-ocean-sand">Entry window start (ET)</span>
              <input
                type="time"
                value={entryStartEt}
                onChange={(e) => onEntryStartChange(e.target.value)}
                className={cn(INPUT, "mt-0.5")}
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-ocean-sand">Entry window end (ET)</span>
              <input
                type="time"
                value={entryEndEt}
                onChange={(e) => onEntryEndChange(e.target.value)}
                className={cn(INPUT, "mt-0.5")}
              />
            </label>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-ocean-sand/80">
            Optional clock gate for Market/Premarket scoring. Leave both empty for no time restriction.
            {entryLegacyLabel ? (
              <>
                {" "}
                Legacy label (not enforced until you set times):{" "}
                <span className="text-ocean-sand">{entryLegacyLabel}</span>
              </>
            ) : null}
          </p>

          <label className="mt-3 block">
            <span className="text-[11px] text-ocean-sand">Bias generator</span>
            <select
              value={biasRuleId}
              onChange={(e) => onBiasRuleIdChange?.(e.target.value)}
              disabled={!onBiasRuleIdChange || builderRows.length === 0}
              className={cn(SELECT, "mt-0.5")}
            >
              <option value="">None — infer from path / met rules</option>
              {composedRules.map(({ row, template }, index) => (
                <option key={row.id} value={row.id}>
                  {biasRuleOptionLabel(row, template, index + 1)}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[10px] leading-relaxed text-ocean-sand/80">
              One rule that sets strategy CALL/PUT (e.g. Vela confirmación). Leave empty for dual-path
              strategies that already encode direction per row.
            </span>
          </label>

          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-ocean-sand/90">
            <span className="rounded-full bg-ocean-mid/35 px-2 py-0.5">
              {pathStats.total} rule{pathStats.total === 1 ? "" : "s"}
            </span>
            {pathStats.call > 0 && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                {pathStats.call} CALL
              </span>
            )}
            {pathStats.put > 0 && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-200">
                {pathStats.put} PUT
              </span>
            )}
            {pathStats.neutral > 0 && (
              <span className="rounded-full bg-ocean-mid/35 px-2 py-0.5">
                {pathStats.neutral} shared
              </span>
            )}
            {incompleteRows.length > 0 && (
              <button
                type="button"
                onClick={scrollToFirstIncomplete}
                className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-200 hover:bg-amber-500/25"
              >
                {incompleteRows.length} need setup — fix
              </button>
            )}
          </div>
        </div>

        {!isEditing && templateStrategies.length > 0 && onCloneFrom && (
          <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-ocean-mid/30 bg-ocean-deep/20 px-3 py-2.5">
            <label className="min-w-[12rem] flex-1">
              <span className="text-[11px] text-ocean-sand">Start from template</span>
              <select
                value={cloneSourceId}
                onChange={(e) => setCloneSourceId(e.target.value)}
                className={cn(SELECT, "mt-0.5 w-full")}
              >
                <option value="">Blank strategy</option>
                {templateStrategies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} — {s.name} ({s.rules?.length ?? 0} rules)
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!cloneSourceId}
              onClick={handleCloneApply}
              className={cn(BTN, "border border-ocean-mid/60 bg-ocean-deep text-ocean-foam hover:border-ocean-teal/50")}
            >
              Load template
            </button>
          </div>
        )}

        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-ocean-sand">
              Rules {pathFilter !== "all" ? `(${filteredComposedRules.length} shown)` : `(${composedRules.length})`}
            </p>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { id: "all" as const, label: "All" },
                  { id: "call" as const, label: "CALL" },
                  { id: "put" as const, label: "PUT" },
                  { id: "neutral" as const, label: "Shared" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPathFilter(tab.id)}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors",
                    pathFilter === tab.id
                      ? tab.id === "call"
                        ? "bg-emerald-500/25 text-emerald-200"
                        : tab.id === "put"
                          ? "bg-amber-500/25 text-amber-200"
                          : "bg-ocean-teal text-ocean-deep"
                      : "bg-ocean-mid/30 text-ocean-sand hover:bg-ocean-mid/50",
                  )}
                >
                  {tab.label}
                  {tab.id === "call" && pathStats.call > 0 ? ` (${pathStats.call})` : ""}
                  {tab.id === "put" && pathStats.put > 0 ? ` (${pathStats.put})` : ""}
                  {tab.id === "neutral" && pathStats.neutral > 0 ? ` (${pathStats.neutral})` : ""}
                </button>
              ))}
            </div>
          </div>

          {composedRules.length === 0 ? (
            <div className="mt-2 rounded-lg border border-dashed border-ocean-mid/40 bg-ocean-deep/20 px-3 py-5 text-xs text-ocean-sand">
              <p className="font-medium text-ocean-foam">No rules yet</p>
              <p className="mt-1 leading-relaxed">
                Add rules from the library, or load an existing strategy as a template above.
                Dual-path setups (E01-style) use separate CALL and PUT rows for the same rule.
              </p>
            </div>
          ) : filteredComposedRules.length === 0 ? (
            <div className="mt-2 rounded-lg border border-dashed border-ocean-mid/40 px-3 py-4 text-center text-xs text-ocean-sand">
              No rules in this path — switch to <strong className="text-ocean-foam">All</strong> or add rows.
            </div>
          ) : (
            <ol className={cn("mt-2 flex-1 space-y-2 overflow-y-auto pr-0.5", rowsMaxHeight)}>
              {filteredComposedRules.map(({ row, template }) => {
                const index = composedRules.findIndex((item) => item.row.id === row.id);
                return (
                  <BuilderRuleRowCard
                    key={row.id}
                    row={row}
                    template={template}
                    rowNumber={index + 1}
                    instance={instanceMeta.get(row.id) ?? { index: 1, total: 1 }}
                    expanded={expandedRows.has(row.id)}
                    isBiasRule={biasRuleId === row.id}
                    onToggleExpand={() => toggleRowExpanded(row.id)}
                    onTrendChange={onTrendChange}
                    onOperationChange={onOperationChange}
                    onRuleTypeChange={onRuleTypeChange}
                    onRemoveRule={onRemoveRule}
                    onMoveRule={onMoveRule}
                    isFirst={index === 0}
                    isLast={index === composedRules.length - 1}
                  />
                );
              })}
            </ol>
          )}
        </div>

        <div className="mt-auto flex flex-wrap gap-2 border-t border-ocean-mid/30 pt-4">
          <button
            type="button"
            className={cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-105")}
            disabled={saving || !canSave}
            onClick={onSave}
          >
            {isEditing ? "Apply changes" : "Stage strategy"}
          </button>
          {onSaveAll ? (
            <button
              type="button"
              className={cn(
                BTN,
                hasUnsavedChanges
                  ? "bg-amber-500 text-ocean-deep hover:brightness-105"
                  : "bg-ocean-mid/50 text-ocean-sand",
              )}
              disabled={saving || !hasUnsavedChanges}
              onClick={onSaveAll}
            >
              {saving ? "Saving…" : hasUnsavedChanges ? `Save all (${dirtyCount})` : "Save all"}
            </button>
          ) : null}
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
