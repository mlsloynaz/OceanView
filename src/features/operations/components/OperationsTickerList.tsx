import { cn } from "@/shared/lib/cn";
import type { OperationsTicker } from "../types";

type Props = {
  tickers: OperationsTicker[];
  selected: Record<string, boolean>;
  enablePending: Record<string, boolean>;
  loading: boolean;
  disabled?: boolean;
  onTogglePick: (symbol: string, checked: boolean) => void;
  onDeactivate: (symbol: string) => void;
};

function formatRange(low: number, high: number): string {
  return `${low}–${high}`;
}

export function OperationsTickerList({
  tickers,
  selected,
  enablePending,
  loading,
  disabled = false,
  onTogglePick,
  onDeactivate,
}: Props) {
  if (loading) {
    return <p className="text-sm text-ocean-sand">Loading operations tickers…</p>;
  }

  if (tickers.length === 0) {
    return (
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
        No tickers have <strong className="font-medium">Operation</strong> enabled yet. Use the
        search above to turn symbols on.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-ocean-mid/40">
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 border-b border-ocean-mid/40 bg-ocean-deep/25 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-ocean-sand">
        <span>Pick</span>
        <span>Symbol</span>
        <span className="text-right">Optimal range</span>
        <span className="text-right">Position</span>
        <span className="text-center">Ops</span>
      </div>
      <ul className="divide-y divide-ocean-mid/30">
        {tickers.map((row) => {
          const hasRange = Boolean(row.optimalRange);
          const rowPending = Boolean(enablePending[row.symbol]);
          const positionLabel = row.position?.status ? row.position.status : "—";
          return (
            <li
              key={row.symbol}
              className={cn(
                "grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 bg-ocean-surface px-3 py-2",
                !hasRange && "opacity-70",
              )}
            >
              <input
                type="checkbox"
                checked={Boolean(selected[row.symbol])}
                disabled={disabled || !hasRange || rowPending}
                onChange={(event) => onTogglePick(row.symbol, event.target.checked)}
                className="h-4 w-4 rounded border-ocean-mid/60 bg-ocean-deep accent-ocean-teal disabled:opacity-40"
                aria-label={`Include ${row.symbol} in option picks`}
                title={hasRange ? "Include in Find picks" : "Needs optimal range"}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ocean-foam">{row.symbol}</span>
                  {row.name ? <span className="truncate text-xs text-ocean-sand">{row.name}</span> : null}
                </div>
                {!hasRange ? (
                  <p className="text-[11px] text-ocean-sand/80">No optimal range — excluded from picks</p>
                ) : null}
              </div>
              <span className="text-right text-xs tabular-nums text-ocean-sand">
                {row.optimalRange
                  ? formatRange(row.optimalRange.low, row.optimalRange.high)
                  : "—"}
              </span>
              <span
                className={cn(
                  "text-right text-[11px] font-medium uppercase tracking-wide",
                  row.position?.status === "bought"
                    ? "text-ocean-teal-dim dark:text-ocean-teal"
                    : row.position?.status === "pending"
                      ? "text-amber-700 dark:text-amber-200"
                      : row.position?.status === "error"
                        ? "text-ocean-danger"
                        : "text-ocean-sand",
                )}
              >
                {positionLabel}
              </span>
              <label className="flex items-center justify-center gap-1.5 text-xs text-ocean-sand">
                <span className="sr-only">Disable operations for {row.symbol}</span>
                <input
                  type="checkbox"
                  checked
                  disabled={disabled || rowPending}
                  onChange={(event) => {
                    if (!event.target.checked) {
                      onDeactivate(row.symbol);
                    }
                  }}
                  className="h-4 w-4 rounded border-ocean-mid/60 bg-ocean-deep accent-ocean-teal disabled:opacity-50"
                  title="Uncheck to remove from Operations"
                />
                <span className="hidden sm:inline" aria-hidden>
                  {rowPending ? "…" : "On"}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
