import { cn } from "@/shared/lib/cn";
import type { OperationsTicker } from "../types";

type Props = {
  tickers: OperationsTicker[];
  enablePending: Record<string, boolean>;
  loading: boolean;
  disabled?: boolean;
  onDeactivate: (symbol: string) => void;
};

function formatRange(low: number, high: number): string {
  return `${low}–${high}`;
}

export function OperationsTickerList({
  tickers,
  enablePending,
  loading,
  disabled = false,
  onDeactivate,
}: Props) {
  if (loading) {
    return <p className="text-base text-ocean-sand">Loading operations tickers…</p>;
  }

  if (tickers.length === 0) {
    return (
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-base text-amber-900 dark:text-amber-100">
        No tickers have <strong className="font-medium">Operation</strong> enabled yet. Use the
        search above to turn symbols on.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-ocean-mid/40">
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-ocean-mid/40 bg-ocean-deep/25 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ocean-sand">
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
                "grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 bg-ocean-surface px-4 py-3",
                !hasRange && "opacity-70",
              )}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-base font-semibold text-ocean-foam">{row.symbol}</span>
                  {row.name ? <span className="truncate text-sm text-ocean-sand">{row.name}</span> : null}
                </div>
                {!hasRange ? (
                  <p className="mt-0.5 text-sm text-ocean-sand/80">
                    No optimal range — excluded from picks
                  </p>
                ) : null}
              </div>
              <span className="text-right text-sm tabular-nums text-ocean-sand">
                {row.optimalRange
                  ? formatRange(row.optimalRange.low, row.optimalRange.high)
                  : "—"}
              </span>
              <span
                className={cn(
                  "text-right text-sm font-medium uppercase tracking-wide",
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
              <label className="flex min-h-11 items-center justify-center gap-2 text-sm text-ocean-sand">
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
                  className="h-5 w-5 rounded border-ocean-mid/60 bg-ocean-deep accent-ocean-teal disabled:opacity-50"
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
