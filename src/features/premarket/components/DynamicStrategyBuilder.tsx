import { useMemo, useState } from "react";
import { cn } from "@/shared/lib/cn";
import type { DynamicRuleTemplate } from "../api/dynamic-strategy-client";
import {
  TIMEFRAME_FILTERS,
  filterRules,
  normalizeTimeframe,
  ruleTypeLabel,
  type TimeframeFilter,
} from "../lib/builder-utils";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const INPUT =
  "w-full rounded-md border border-ocean-mid/40 bg-ocean-deep px-3 py-2 text-sm text-ocean-foam placeholder:text-ocean-sand/50 focus:border-ocean-teal/50 focus:outline-none";

type Props = {
  rules: DynamicRuleTemplate[];
  selectedRuleKeys: string[];
  name: string;
  shortName: string;
  description: string;
  direction: "" | "CALL" | "PUT";
  editingStrategyId: string | null;
  saving: boolean;
  startPending: boolean;
  error?: string | null;
  onNameChange: (value: string) => void;
  onShortNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onDirectionChange: (value: "" | "CALL" | "PUT") => void;
  onAddRule: (ruleKey: string) => void;
  onRemoveRule: (ruleKey: string) => void;
  onMoveRule: (ruleKey: string, direction: "up" | "down") => void;
  onCancel: () => void;
  onSave: () => void;
  onPreview: () => void;
};

export function DynamicStrategyBuilder({
  rules,
  selectedRuleKeys,
  name,
  shortName,
  description,
  direction,
  editingStrategyId,
  saving,
  startPending,
  error,
  onNameChange,
  onShortNameChange,
  onDescriptionChange,
  onDirectionChange,
  onAddRule,
  onRemoveRule,
  onMoveRule,
  onCancel,
  onSave,
  onPreview,
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
      selectedRuleKeys
        .map((key) => ruleMap.get(key))
        .filter((r): r is DynamicRuleTemplate => r != null),
    [selectedRuleKeys, ruleMap],
  );

  const canSave = name.trim().length > 0 && selectedRuleKeys.length > 0;
  const isEditing = editingStrategyId != null;

  return (
    <div className="grid gap-0 divide-y divide-ocean-mid/30 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
      {error && (
        <p className="col-span-full border-b border-ocean-danger/30 bg-ocean-danger/10 px-4 py-2 text-sm text-ocean-danger" role="alert">
          {error}
        </p>
      )}

      <div className="p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ocean-sand">
          Rule library
        </h3>
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
        <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto pr-1">
          {filteredLibrary.map((rule) => {
            const added = selectedRuleKeys.includes(rule.ruleKey);
            return (
              <li key={rule.ruleKey}>
                <button
                  type="button"
                  disabled={added}
                  onClick={() => onAddRule(rule.ruleKey)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors",
                    added
                      ? "cursor-default border-ocean-teal/30 bg-ocean-teal/5 opacity-60"
                      : "border-ocean-mid/30 hover:border-ocean-teal/40 hover:bg-ocean-deep/50",
                  )}
                >
                  <span className="mt-0.5 text-ocean-teal">{added ? "✓" : "+"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-ocean-foam">{rule.label}</span>
                    <span className="mt-0.5 flex flex-wrap gap-1.5 text-[10px] text-ocean-sand">
                      {rule.timeframe && (
                        <span className="rounded bg-ocean-mid/40 px-1 py-px">
                          {normalizeTimeframe(rule.timeframe)}
                        </span>
                      )}
                      <span className="rounded bg-ocean-mid/40 px-1 py-px">
                        {ruleTypeLabel(rule.defaultType)}
                      </span>
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
              placeholder="e.g. Premarket BB touch"
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
          <label className="block">
            <span className="text-[11px] text-ocean-sand">
              Trade direction (optional)
            </span>
            <select
              value={direction}
              onChange={(e) => onDirectionChange(e.target.value as "" | "CALL" | "PUT")}
              className={cn(INPUT, "mt-0.5")}
            >
              <option value="">Auto (playbook / rules / trend)</option>
              <option value="CALL">CALL</option>
              <option value="PUT">PUT</option>
            </select>
            <span className="mt-0.5 block text-[10px] text-ocean-sand/80">
              Used for danger checks (clear path) when not inferred from playbook.
            </span>
          </label>
        </div>

        <div className="mt-4">
          <p className="text-[11px] font-medium text-ocean-sand">
            Rules ({composedRules.length})
          </p>
          {composedRules.length === 0 ? (
            <p className="mt-2 rounded-md border border-dashed border-ocean-mid/40 px-3 py-6 text-center text-xs text-ocean-sand">
              Click rules in the library to add them here.
            </p>
          ) : (
            <ol className="mt-2 space-y-1.5">
              {composedRules.map((rule, index) => (
                <li
                  key={rule.ruleKey}
                  className="flex items-center gap-2 rounded-md border border-ocean-mid/30 bg-ocean-deep/30 px-2 py-1.5"
                >
                  <span className="w-4 shrink-0 text-center text-[10px] tabular-nums text-ocean-sand">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-xs">
                    <span className="font-medium text-ocean-foam">{rule.label}</span>
                    {rule.timeframe && (
                      <span className="ml-1 text-ocean-sand/70">
                        · {normalizeTimeframe(rule.timeframe)}
                      </span>
                    )}
                  </span>
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      type="button"
                      title="Move up"
                      disabled={index === 0}
                      onClick={() => onMoveRule(rule.ruleKey, "up")}
                      className="rounded px-1 text-ocean-sand hover:bg-ocean-mid/40 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      title="Move down"
                      disabled={index === composedRules.length - 1}
                      onClick={() => onMoveRule(rule.ruleKey, "down")}
                      className="rounded px-1 text-ocean-sand hover:bg-ocean-mid/40 disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => onRemoveRule(rule.ruleKey)}
                      className="rounded px-1 text-ocean-danger hover:bg-ocean-danger/10"
                    >
                      ×
                    </button>
                  </div>
                </li>
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
            disabled={startPending || selectedRuleKeys.length === 0}
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
        </div>
      </div>
    </div>
  );
}
