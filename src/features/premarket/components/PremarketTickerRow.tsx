import { cn } from "@/shared/lib/cn";
import { DirectionDisplay } from "@/features/market/components/StrategyAssessMeta";
import { qualityBadgeClass } from "../display";
import type { PremarketTickerHit } from "../types";

type Props = {
  ticker: PremarketTickerHit;
  threshold: number;
  onOpen: () => void;
};

export function PremarketTickerRow({ ticker, threshold, onOpen }: Props) {
  const hasDangerPenalty =
    typeof ticker.dangerPenaltyPct === "number" && ticker.dangerPenaltyPct < 0;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        title="View rule pass details"
        className={cn(
          "inline-flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1 text-sm font-semibold tabular-nums transition-opacity hover:brightness-110",
          qualityBadgeClass(ticker.qualityPct, threshold),
        )}
      >
        <span>{ticker.symbol}</span>
        {ticker.direction && (
          <DirectionDisplay direction={ticker.direction} compact />
        )}
        {ticker.name && (
          <span className="hidden font-normal opacity-75 sm:inline">{ticker.name}</span>
        )}
        <span className="font-normal opacity-90">{ticker.qualityPct}%</span>
        {hasDangerPenalty && (
          <span className="text-[10px] font-normal text-ocean-danger">
            ({ticker.dangerPenaltyPct}%)
          </span>
        )}
      </button>
    </li>
  );
}
