import { cn } from "@/shared/lib/cn";
import { qualityBadgeClass } from "../display";
import type { PremarketTickerHit } from "../types";

type Props = {
  ticker: PremarketTickerHit;
  threshold: number;
};

export function PremarketTickerRow({ ticker, threshold }: Props) {
  return (
    <li
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-sm font-semibold tabular-nums",
        qualityBadgeClass(ticker.qualityPct, threshold),
      )}
    >
      <span>{ticker.symbol}</span>
      {ticker.name && (
        <span className="hidden font-normal opacity-75 sm:inline">{ticker.name}</span>
      )}
      <span className="font-normal opacity-90">{ticker.qualityPct}%</span>
    </li>
  );
}
