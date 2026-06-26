import type { StrategyCatalogItem, TickerCardModel } from "../types";
import { directionBadgeClass, mergeRuleDisplay, qualityBadgeClass } from "../display";
import { RuleCheckStrip } from "./RuleCheckStrip";
import { cn } from "@/shared/lib/cn";

type Props = {
  card: TickerCardModel;
  threshold: number;
  strategyById: Map<string, StrategyCatalogItem>;
  onOpen: (symbol: string) => void;
};

export function TickerCard({ card, threshold, strategyById, onOpen }: Props) {
  const { symbol, name, signalCount, bestSignal, topStrategyEval } = card;
  const hasSignals = signalCount > 0;
  const topCatalog = topStrategyEval
    ? strategyById.get(topStrategyEval.strategyId)
    : null;
  const topRules =
    topStrategyEval && topCatalog
      ? mergeRuleDisplay(topCatalog.rules, topStrategyEval.rules)
      : [];

  return (
    <article className="flex flex-col rounded-xl border border-ocean-mid/50 bg-ocean-surface p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold text-ocean-foam">{symbol}</h3>
          {name && <p className="mt-0.5 truncate text-xs text-ocean-sand">{name}</p>}
        </div>
        <button
          type="button"
          onClick={() => onOpen(symbol)}
          className="shrink-0 rounded-md border border-ocean-mid/60 px-2 py-1 text-[11px] font-medium text-ocean-sand transition-colors hover:border-ocean-teal/50 hover:text-ocean-teal-dim dark:hover:text-ocean-teal"
        >
          View detail
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            hasSignals
              ? "bg-ocean-teal/15 text-ocean-teal-dim dark:text-ocean-teal"
              : "bg-ocean-mid/30 text-ocean-sand",
          )}
        >
          {signalCount === 1 ? "1 strategy signal" : `${signalCount} strategy signals`}
        </span>
        {bestSignal?.direction && (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
              directionBadgeClass(bestSignal.direction),
            )}
          >
            {bestSignal.direction}
          </span>
        )}
      </div>

      <div className="mt-3 min-h-[4.5rem] flex-1">
        {bestSignal ? (
          <>
            <p className="text-[11px] font-medium uppercase tracking-wide text-ocean-sand">
              Best signal
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                  qualityBadgeClass(bestSignal.qualityPct, threshold),
                )}
              >
                {bestSignal.strategyName} · {bestSignal.qualityPct}%
              </span>
            </div>
          </>
        ) : topStrategyEval ? (
          <p className="text-xs text-ocean-sand">
            Top: {topCatalog?.name ?? topStrategyEval.strategyId} ({topStrategyEval.qualityPct}%)
          </p>
        ) : (
          <p className="text-xs text-ocean-sand">No strategy evaluation available.</p>
        )}

        {topRules.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-ocean-sand">Rules</span>
            <RuleCheckStrip rules={topRules} />
          </div>
        )}
      </div>
    </article>
  );
}
