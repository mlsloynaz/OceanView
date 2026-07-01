import { cn } from "@/shared/lib/cn";
import type { DynamicStrategy } from "../api/dynamic-strategy-client";
import { normalizeTimeframe } from "../lib/builder-utils";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  strategies: DynamicStrategy[];
  selectedStrategyIds: string[];
  saving: boolean;
  startPending: boolean;
  onToggleSelection: (strategyId: string) => void;
  onSelectAllActive: () => void;
  onClearSelection: () => void;
  onEdit: (strategy: DynamicStrategy) => void;
  onToggleActive: (strategy: DynamicStrategy) => void;
  onDelete: (strategyId: string) => void;
  onEvaluateSelected: () => void;
};

export function DynamicStrategyCatalog({
  strategies,
  selectedStrategyIds,
  saving,
  startPending,
  onToggleSelection,
  onSelectAllActive,
  onClearSelection,
  onEdit,
  onToggleActive,
  onDelete,
  onEvaluateSelected,
}: Props) {
  const activeCount = strategies.filter((s) => s.active).length;
  const selectedCount = selectedStrategyIds.length;

  return (
    <section className="rounded-xl border border-ocean-mid/50 bg-ocean-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ocean-foam">Saved strategies</h2>
          <p className="mt-0.5 text-xs text-ocean-sand">
            {strategies.length} in Dynamo · {activeCount} active · {selectedCount} selected for
            evaluate
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-105")}
            disabled={saving || startPending || selectedCount === 0}
            onClick={onEvaluateSelected}
          >
            {startPending ? "Evaluating…" : `Evaluate selected (${selectedCount})`}
          </button>
          <button
            type="button"
            className={cn(
              BTN,
              "border border-ocean-mid/60 bg-ocean-deep text-ocean-foam hover:border-ocean-teal/50",
            )}
            disabled={saving || activeCount === 0}
            onClick={onSelectAllActive}
          >
            Select active
          </button>
          <button
            type="button"
            className={cn(BTN, "text-ocean-sand hover:text-ocean-foam")}
            disabled={selectedCount === 0}
            onClick={onClearSelection}
          >
            Clear selection
          </button>
        </div>
      </div>

      {strategies.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-ocean-mid/40 px-4 py-8 text-center text-sm text-ocean-sand">
          No saved strategies yet. Use the builder above to compose rules and save your first
          screen.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {strategies.map((strategy) => {
            const checked = selectedStrategyIds.includes(strategy.id);
            return (
              <li
                key={strategy.id}
                className={cn(
                  "rounded-lg border px-3 py-3 transition-colors",
                  checked ? "border-ocean-teal/40 bg-ocean-teal/5" : "border-ocean-mid/30",
                  !strategy.active && "opacity-70",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <label className="flex min-w-0 cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked}
                      disabled={!strategy.active}
                      onChange={() => onToggleSelection(strategy.id)}
                    />
                    <span className="min-w-0">
                      <span className="font-medium text-ocean-foam">{strategy.name}</span>
                      {strategy.shortName && strategy.shortName !== strategy.name && (
                        <span className="ml-2 text-xs text-ocean-sand">({strategy.shortName})</span>
                      )}
                      <span
                        className={cn(
                          "ml-2 inline rounded px-1.5 py-px text-[10px] font-medium uppercase",
                          strategy.active
                            ? "bg-ocean-teal/20 text-ocean-teal"
                            : "bg-ocean-mid/40 text-ocean-sand",
                        )}
                      >
                        {strategy.active ? "active" : "inactive"}
                      </span>
                      {strategy.description && (
                        <p className="mt-1 text-xs text-ocean-sand">{strategy.description}</p>
                      )}
                    </span>
                  </label>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs text-ocean-teal hover:underline"
                      disabled={saving}
                      onClick={() => onEdit(strategy)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs text-ocean-teal hover:underline"
                      disabled={saving}
                      onClick={() => onToggleActive(strategy)}
                    >
                      {strategy.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-ocean-danger hover:underline"
                      disabled={saving}
                      onClick={() => onDelete(strategy.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5 pl-6">
                  {strategy.rules.map((rule) => (
                    <li
                      key={rule.id}
                      className="rounded bg-ocean-mid/30 px-2 py-0.5 text-[10px] text-ocean-sand"
                      title={rule.ruleKey}
                    >
                      {rule.label}
                      {rule.timeframe && (
                        <span className="ml-1 opacity-70">
                          · {normalizeTimeframe(rule.timeframe)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
