import { RuleCheckStrip } from "@/features/market/components/RuleCheckStrip";
import { DirectionDisplay } from "@/features/market/components/StrategyAssessMeta";
import { cn } from "@/shared/lib/cn";
import { qualityBadgeClass, toPremarketDisplayRules } from "../display";
import type { PremarketTickerHit } from "../types";

type Props = {
  ticker: PremarketTickerHit;
  threshold: number;
  onOpen: () => void;
};

export function PremarketTickerRow({ ticker, threshold, onOpen }: Props) {
  const rules = toPremarketDisplayRules(ticker.rules);
  const hasDangerPenalty =
    typeof ticker.dangerPenaltyPct === "number" && ticker.dangerPenaltyPct < 0;

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
        {rules.length > 0 && <RuleCheckStrip rules={rules} />}
      </button>
    </li>
  );
}
