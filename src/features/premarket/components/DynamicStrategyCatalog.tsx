import { cn } from "@/shared/lib/cn";
import type { DynamicStrategy } from "../api/dynamic-strategy-client";
import { normalizeTimeframe } from "../lib/builder-utils";

type Props = {
  strategies: DynamicStrategy[];
  saving: boolean;
  onEdit: (strategy: DynamicStrategy) => void;
  onToggleActive: (strategy: DynamicStrategy) => void;
};

export function DynamicStrategyCatalog({
  strategies,
  saving,
  onEdit,
  onToggleActive,
}: Props) {
  const activeCount = strategies.filter((s) => s.active).length;

  return (
    <section className="rounded-xl border border-ocean-mid/50 bg-ocean-surface p-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-ocean-foam">Saved strategies</h2>
        <p className="mt-0.5 text-xs text-ocean-sand">
          {strategies.length} in Dynamo · {activeCount} active for evaluate
        </p>
      </div>

      {strategies.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-ocean-mid/40 px-4 py-8 text-center text-sm text-ocean-sand">
          No saved strategies yet. Use the builder above to compose rules and save your first
          screen.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {strategies.map((strategy) => (
            <li
              key={strategy.id}
              className={cn(
                "rounded-lg border border-ocean-mid/30 px-3 py-3",
                !strategy.active && "opacity-70",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
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
                </div>
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
                </div>
              </div>
              <ul className="mt-2 flex flex-wrap gap-1.5">
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
          ))}
        </ul>
      )}
    </section>
  );
}
