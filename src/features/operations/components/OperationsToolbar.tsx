import { cn } from "@/shared/lib/cn";
import type { ContractType } from "../types";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  contractType: ContractType;
  selectedCount: number;
  eligibleCount: number;
  picksPending: boolean;
  loading: boolean;
  onContractTypeChange: (value: ContractType) => void;
  onSelectAll: (checked: boolean) => void;
  onRunPicks: () => void;
  onReload: () => void;
};

export function OperationsToolbar({
  contractType,
  selectedCount,
  eligibleCount,
  picksPending,
  loading,
  onContractTypeChange,
  onSelectAll,
  onRunPicks,
  onReload,
}: Props) {
  const busy = loading || picksPending;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-3 py-2.5">
      <div className="flex items-center gap-1 rounded-md border border-ocean-mid/50 p-0.5">
        {(["CALL", "PUT"] as const).map((value) => (
          <button
            key={value}
            type="button"
            disabled={busy}
            onClick={() => onContractTypeChange(value)}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-semibold transition-colors",
              contractType === value
                ? value === "CALL"
                  ? "bg-ocean-teal/25 text-ocean-teal-dim dark:text-ocean-teal"
                  : "bg-ocean-danger-muted text-ocean-danger"
                : "text-ocean-sand hover:text-ocean-foam",
            )}
          >
            {value}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={busy || eligibleCount === 0}
        onClick={() => onSelectAll(selectedCount < eligibleCount)}
        className={cn(BTN, "border border-ocean-mid/50 text-ocean-sand hover:border-ocean-teal/40")}
      >
        {selectedCount < eligibleCount ? "Select all eligible" : "Clear selection"}
      </button>

      <button
        type="button"
        disabled={busy || selectedCount === 0}
        onClick={onRunPicks}
        className={cn(BTN, "bg-ocean-teal text-ocean-deep hover:bg-ocean-teal/90")}
      >
        {picksPending ? "Finding picks…" : `Find ${contractType} picks (${selectedCount})`}
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={() => void onReload()}
        className={cn(BTN, "border border-ocean-mid/50 text-ocean-sand hover:text-ocean-foam")}
      >
        Reload tickers
      </button>
    </div>
  );
}
