import { cn } from "@/shared/lib/cn";
import {
  contextStatusClass,
  contextStatusLabel,
  formatIntervals,
  outcomeClass,
  outcomeLabel,
} from "./display";
import type { CandlesPaneRow } from "./hooks/useCandlesPane";

type Props = {
  rows: CandlesPaneRow[];
  loading: boolean;
  bulkPending: boolean;
  rowPending: Record<string, boolean>;
  onRefreshOne: (symbol: string) => void;
};

export function CandlesTable({
  rows,
  loading,
  bulkPending,
  rowPending,
  onRefreshOne,
}: Props) {
  if (loading) {
    return null;
  }

  if (rows.length === 0) {
    return (
      <p className="leading-snug text-ocean-sand">
        No tickers in catalog. Activate symbols in Tickers above.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-ocean-mid/30 overflow-hidden rounded-lg border border-ocean-mid/40">
      {rows.map((row, index) => {
        const candle = row.candle;
        const symbolUpper = row.symbol.toUpperCase();
        const pending = bulkPending || Boolean(rowPending[symbolUpper]);
        const isLastFavorite =
          row.isFavorite &&
          (index === rows.length - 1 || !rows[index + 1]?.isFavorite);
        const intervals = candle ? formatIntervals(candle.context.intervals) : null;

        return (
          <li
            key={row.symbol}
            className={cn(
              "flex flex-wrap items-center justify-between gap-x-2 gap-y-1 bg-ocean-surface px-2 py-2",
              isLastFavorite && index < rows.length - 1 && "border-b-2 border-ocean-teal/30",
            )}
          >
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
              {row.isFavorite && (
                <span className="text-xs text-ocean-teal" title="Favorite">
                  ★
                </span>
              )}
              <span className="text-sm font-semibold text-ocean-foam">{row.symbol}</span>
              {row.name && <span className="text-xs text-ocean-sand">{row.name}</span>}

              {candle ? (
                <>
                  <span className={outcomeClass(candle.outcome)} title="Intake outcome">
                    {outcomeLabel(candle.outcome)}
                  </span>
                  <span
                    className={contextStatusClass(candle.context.status)}
                    title="Candle context status"
                  >
                    Ctx: {contextStatusLabel(candle.context.status)}
                  </span>
                  {intervals && (
                    <span className="w-full text-ocean-sand sm:w-auto">
                      Intervals: {intervals}
                    </span>
                  )}
                  <span className="w-full text-ocean-sand sm:w-auto">
                    Last bar: {candle.context.lastBarAt ?? "—"}
                  </span>
                  {candle.message && (
                    <span className="w-full text-ocean-sand/80">{candle.message}</span>
                  )}
                  {candle.context.error && (
                    <span className="w-full text-ocean-danger">{candle.context.error}</span>
                  )}
                </>
              ) : (
                <span className="text-ocean-sand">No candle data</span>
              )}
            </div>

            <button
              type="button"
              disabled={pending}
              onClick={() => onRefreshOne(row.symbol)}
              className="shrink-0 rounded border border-ocean-mid/60 bg-ocean-deep px-2 py-1 text-xs font-medium text-ocean-foam hover:border-ocean-teal/50 disabled:opacity-50"
            >
              {pending ? "…" : "Refresh"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
