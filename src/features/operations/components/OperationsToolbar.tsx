import { cn } from "@/shared/lib/cn";
import type { ContractType } from "../types";

const BTN =
  "min-h-11 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  contractType: ContractType;
  eligibleCount: number;
  picksPending: boolean;
  loading: boolean;
  onContractTypeChange: (value: ContractType) => void;
  onRunPicks: () => void;
  onReload: () => void;
};

export function OperationsToolbar({
  contractType,
  eligibleCount,
  picksPending,
  loading,
  onContractTypeChange,
  onRunPicks,
  onReload,
}: Props) {
  const busy = loading || picksPending;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-4 py-3">
      <div className="flex items-center gap-1 rounded-md border border-ocean-mid/50 p-1">
        {(["CALL", "PUT"] as const).map((value) => (
          <button
            key={value}
            type="button"
            disabled={busy}
            onClick={() => onContractTypeChange(value)}
            className={cn(
              "min-h-10 rounded-md px-4 py-2 text-sm font-semibold transition-colors",
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
        onClick={onRunPicks}
        className={cn(BTN, "bg-ocean-teal text-ocean-deep hover:bg-ocean-teal/90")}
      >
        {picksPending ? "Finding picks…" : `Find ${contractType} picks (${eligibleCount})`}
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
