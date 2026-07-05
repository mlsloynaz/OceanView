import { cn } from "@/shared/lib/cn";
import type { StrategyCatalogItem } from "@/features/market/types";

type Props = {
  strategies: StrategyCatalogItem[];
  saving: boolean;
  onToggleActive: (strategy: StrategyCatalogItem) => void;
};

export function StandardStrategyCatalog({ strategies, saving, onToggleActive }: Props) {
  if (strategies.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-ocean-mid/40 px-4 py-6 text-center text-sm text-ocean-sand">
        No standard strategies in the market catalog.
      </p>
    );
  }

  const activeCount = strategies.filter((s) => s.active !== false).length;

  return (
    <div>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ocean-foam">Standard strategies</h3>
        <p className="mt-0.5 text-[11px] text-ocean-sand">
          Built-in playbooks from the market catalog — activate or deactivate only ({activeCount} of{" "}
          {strategies.length} active for Market assess).
        </p>
      </div>
      <ul className="space-y-2">
        {strategies.map((strategy) => {
          const active = strategy.active !== false;
          return (
            <li
              key={strategy.id}
              className={cn(
                "rounded-lg border border-ocean-mid/30 px-3 py-3",
                !active && "opacity-70",
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
                      active
                        ? "bg-ocean-teal/20 text-ocean-teal"
                        : "bg-ocean-mid/40 text-ocean-sand",
                    )}
                  >
                    {active ? "active" : "inactive"}
                  </span>
                  {strategy.description && (
                    <p className="mt-1 text-xs text-ocean-sand">{strategy.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  className="shrink-0 text-xs text-ocean-teal hover:underline disabled:opacity-50"
                  disabled={saving}
                  onClick={() => onToggleActive(strategy)}
                >
                  {active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
