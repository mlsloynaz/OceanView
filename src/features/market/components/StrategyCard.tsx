import type { StrategyCardModel } from "../types";
import { formatEntryWindow } from "../lib/entry-window";
import { qualityBadgeClass, signalCountLabel } from "../display";
import { cn } from "@/shared/lib/cn";

type Props = {
  card: StrategyCardModel;
  threshold: number;
  onOpen: (strategyId: string) => void;
};

export function StrategyCard({ card, threshold, onOpen }: Props) {
  const { strategy, signalCount, previewTickers } = card;
  const hasSignals = signalCount > 0;
  const entryWindowLabel = formatEntryWindow(strategy.entryWindow);

  return (
    <article className="flex flex-col rounded-xl border border-ocean-mid/50 bg-ocean-surface p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-semibold text-ocean-foam">
            {strategy.name}
          </h3>
          {entryWindowLabel && (
            <p className="mt-0.5 line-clamp-1 text-[11px] text-ocean-sand">{entryWindowLabel}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpen(strategy.id)}
          className="shrink-0 rounded-md border border-ocean-mid/60 px-2 py-1 text-[11px] font-medium text-ocean-sand transition-colors hover:border-ocean-teal/50 hover:text-ocean-teal-dim dark:hover:text-ocean-teal"
        >
          View detail
        </button>
      </div>

      <div className="mt-3">
        <span
          className={cn(
            "inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            hasSignals
              ? "bg-ocean-teal/15 text-ocean-teal-dim dark:text-ocean-teal"
              : "bg-ocean-mid/30 text-ocean-sand",
          )}
        >
          {signalCountLabel(signalCount)}
        </span>
      </div>

      <div className="mt-3 min-h-[4.5rem] flex-1">
        {hasSignals ? (
          <>
            <p className="text-[11px] font-medium uppercase tracking-wide text-ocean-sand">
              Tickers meeting now
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {previewTickers.map((t) => (
                <li key={t.symbol}>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                      qualityBadgeClass(t.qualityPct, threshold),
                    )}
                  >
                    {t.symbol}
                    <span className="font-normal opacity-80">({t.qualityPct}%)</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-xs text-ocean-sand">No tickers currently meeting criteria.</p>
        )}
      </div>
    </article>
  );
}
