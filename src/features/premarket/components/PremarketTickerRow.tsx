import { RuleCheckStrip } from "@/features/market/components/RuleCheckStrip";
import { DirectionDisplay } from "@/features/market/components/StrategyAssessMeta";
import { cn } from "@/shared/lib/cn";
import { formatStrategyScores, qualityBadgeClass, toPremarketDisplayRules } from "../display";
import type {
  BestResultMonitorTicker,
  PremarketStrategyScore,
  PremarketTickerHit,
} from "../types";

type Props = {
  ticker: PremarketTickerHit;
  threshold: number;
  onOpen: () => void;
  /** When set (Best results), show each strategy contribution under the chip. */
  strategyScores?: PremarketStrategyScore[];
  /** Live strike monitor row (COGER pick + 12% move estimate). */
  monitor?: BestResultMonitorTicker | null;
};

export function PremarketTickerRow({
  ticker,
  threshold,
  onOpen,
  strategyScores,
  monitor,
}: Props) {
  const rules = toPremarketDisplayRules(ticker.rules);
  const hasDangerPenalty =
    typeof ticker.dangerPenaltyPct === "number" && ticker.dangerPenaltyPct < 0;
  const multiStrategy = (strategyScores?.length ?? 0) > 1;
  const scoresLine =
    strategyScores && strategyScores.length > 0 ? formatStrategyScores(strategyScores) : null;
  const pick = monitor?.pick;
  const estimate = monitor?.estimate;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        title="View rule pass details"
        className={cn(
          "inline-flex cursor-pointer flex-col items-start gap-1.5 rounded-lg border border-ocean-mid/40 px-2.5 py-2 text-left transition-opacity hover:brightness-110",
          qualityBadgeClass(ticker.qualityPct, threshold),
        )}
      >
        <span className="inline-flex flex-wrap items-center gap-2 text-sm font-semibold tabular-nums">
          <span>{ticker.symbol}</span>
          {ticker.direction && <DirectionDisplay direction={ticker.direction} compact />}
          {ticker.name && (
            <span className="hidden font-normal opacity-75 sm:inline">{ticker.name}</span>
          )}
          <span className="font-normal opacity-90">{ticker.qualityPct}%</span>
          {hasDangerPenalty && (
            <span className="text-[10px] font-normal text-ocean-danger">
              ({ticker.dangerPenaltyPct}%)
            </span>
          )}
        </span>
        {scoresLine && (
          <span className="text-[11px] font-normal leading-snug opacity-90">{scoresLine}</span>
        )}
        {monitor && (
          <span className="flex flex-col gap-0.5 text-[11px] font-normal leading-snug opacity-95">
            {typeof monitor.spot === "number" && (
              <span>
                Spot {monitor.spot}
                {typeof monitor.movePct === "number" ? ` · move ${monitor.movePct}%` : ""}
              </span>
            )}
            {pick ? (
              <span>
                Strike {pick.strike}
                {pick.expiration ? ` ${pick.expiration}` : ""}
                {` · ask $${pick.ask}`}
                {typeof pick.dte === "number" ? ` · ${pick.dte}d` : ""}
                {typeof pick.distancePct === "number" ? ` · ${pick.distancePct}%` : ""}
              </span>
            ) : (
              <span className="opacity-80">{monitor.error || "no COGER strike"}</span>
            )}
            {estimate && typeof estimate.gainPct === "number" && (
              <span>
                est. @ {estimate.atMoveCapPct}% move · {estimate.gainPct}%
                {typeof estimate.gainUsdPerContract === "number"
                  ? ` ($${estimate.gainUsdPerContract}/ct)`
                  : ""}
              </span>
            )}
          </span>
        )}
        {!multiStrategy && !monitor && rules.length > 0 && <RuleCheckStrip rules={rules} />}
      </button>
    </li>
  );
}
