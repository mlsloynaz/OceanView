import { RuleCheckStrip } from "@/features/market/components/RuleCheckStrip";
import { DirectionDisplay } from "@/features/market/components/StrategyAssessMeta";
import { cn } from "@/shared/lib/cn";
import {
  formatMoneyPrice,
  formatStrategyScores,
  qualityBadgeClass,
  resolveBestResultTradeSummary,
  resolveEstimatedExitPrice,
  toPremarketDisplayRules,
} from "../display";
import type {
  BestResultMonitorTicker,
  BestResultStrikePick,
  PremarketStrategyScore,
  PremarketTickerHit,
} from "../types";
import { BestResultTradeSummaryPanel } from "./BestResultTradeSummary";

type Props = {
  ticker: PremarketTickerHit;
  threshold: number;
  /** Opens rules / full detail modal */
  onOpenRules: () => void;
  strategyScores?: PremarketStrategyScore[];
  monitor?: BestResultMonitorTicker | null;
  /** Assess-time COGER pick (shown when monitor has not loaded). */
  assessPick?: BestResultStrikePick | null;
  assessSpot?: number | null;
  /**
   * `exit-only` — strategy result chips: estimated exit price only.
   * `trade` — Best results: current, exit, obstacle, strike.
   */
  priceDetail?: "exit-only" | "trade";
};

function StopIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className={className} fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function PremarketTickerRow({
  ticker,
  threshold,
  onOpenRules,
  strategyScores,
  monitor,
  assessPick,
  assessSpot,
  priceDetail = "exit-only",
}: Props) {
  const rules = toPremarketDisplayRules(ticker.rules);
  const hasDangerPenalty =
    typeof ticker.dangerPenaltyPct === "number" && ticker.dangerPenaltyPct < 0;
  const multiStrategy = (strategyScores?.length ?? 0) > 1;
  const scoresLine =
    strategyScores && strategyScores.length > 0 ? formatStrategyScores(strategyScores) : null;
  const profile = monitor?.movementProfile ?? ticker.movementProfile ?? null;
  const exhaustion = Boolean(monitor?.exhaustionRisk ?? profile?.exhaustionRisk);
  const showTrade = priceDetail === "trade";
  const tradeSummary = showTrade
    ? resolveBestResultTradeSummary({
        monitor,
        profile,
        dangers: ticker.dangers,
        pick: assessPick,
        spot: assessSpot,
      })
    : null;
  const estimatedExit = !showTrade
    ? resolveEstimatedExitPrice({
        monitor,
        profile,
        dangers: ticker.dangers,
      })
    : null;

  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onOpenRules}
        title={showTrade ? "View trade levels and strategy rules" : "View strategy rules"}
        className={cn(
          "flex w-full cursor-pointer flex-col items-start gap-1.5 rounded-lg border px-2.5 py-2 text-left transition-opacity hover:brightness-110",
          exhaustion ? "border-ocean-danger/70 bg-ocean-danger/10" : "border-ocean-mid/40",
          !exhaustion && qualityBadgeClass(ticker.qualityPct, threshold),
        )}
      >
        <span className="inline-flex w-full flex-wrap items-center gap-2 text-sm font-semibold tabular-nums">
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
          {exhaustion && (
            <span className="inline-flex items-center gap-0.5 text-ocean-danger">
              <StopIcon className="h-4 w-4" />
              <span className="text-[10px] font-semibold uppercase tracking-wide">Stop</span>
            </span>
          )}
        </span>
        {scoresLine && (
          <span className="text-[11px] font-normal leading-snug opacity-90">{scoresLine}</span>
        )}
        {showTrade && tradeSummary && <BestResultTradeSummaryPanel summary={tradeSummary} compact />}
        {!showTrade && estimatedExit != null && (
          <span className="text-[11px] font-normal leading-snug opacity-95">
            <span className="opacity-80">Estimated exit </span>
            <span className="font-semibold tabular-nums">{formatMoneyPrice(estimatedExit)}</span>
          </span>
        )}
        {!multiStrategy && !monitor && rules.length > 0 && <RuleCheckStrip rules={rules} />}
      </button>
    </li>
  );
}
