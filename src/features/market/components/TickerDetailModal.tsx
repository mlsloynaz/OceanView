import { useState } from "react";
import type { StrategyCatalogItem, TickerEvalResult } from "../types";
import {
  directionBadgeClass,
  isSignal,
  mergeRuleDisplay,
  qualityBadgeClass,
} from "../display";
import { MarketDetailModal } from "./MarketDetailModal";
import { RuleCheckStrip } from "./RuleCheckStrip";
import { RuleRequirementsList } from "./RuleRequirementsList";
import { cn } from "@/shared/lib/cn";

type Props = {
  ticker: TickerEvalResult;
  strategyById: Map<string, StrategyCatalogItem>;
  threshold: number;
  onClose: () => void;
};

export function TickerDetailModal({ ticker, strategyById, threshold, onClose }: Props) {
  const sorted = [...ticker.strategies].sort((a, b) => b.qualityPct - a.qualityPct);
  const [expandedStrategyId, setExpandedStrategyId] = useState<string | null>(
    sorted.find((s) => isSignal(s.qualityPct, threshold))?.strategyId ?? sorted[0]?.strategyId ?? null,
  );

  return (
    <MarketDetailModal
      open
      onClose={onClose}
      title={ticker.symbol}
      subtitle={ticker.name ?? undefined}
    >
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ocean-sand">
        Strategies evaluated
      </h3>

      <ul className="space-y-2">
        {sorted.map((ev) => {
          const catalog = strategyById.get(ev.strategyId);
          const rules = catalog ? mergeRuleDisplay(catalog.rules, ev.rules) : [];
          const expanded = expandedStrategyId === ev.strategyId;
          const signal = isSignal(ev.qualityPct, threshold);

          return (
            <li
              key={ev.strategyId}
              className={cn(
                "overflow-hidden rounded-lg border border-ocean-mid/40",
                signal && "border-ocean-teal/30",
              )}
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedStrategyId(expanded ? null : ev.strategyId)
                }
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-ocean-deep/40"
                aria-expanded={expanded}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ocean-foam">
                      {catalog?.name ?? ev.strategyId}
                    </span>
                    {ev.direction && (
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                          directionBadgeClass(ev.direction),
                        )}
                      >
                        {ev.direction}
                      </span>
                    )}
                  </div>
                  {catalog?.entryWindow && (
                    <p className="mt-0.5 text-[11px] text-ocean-sand">{catalog.entryWindow}</p>
                  )}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded px-2 py-0.5 text-xs font-semibold tabular-nums",
                    qualityBadgeClass(ev.qualityPct, threshold),
                  )}
                >
                  {ev.qualityPct}%
                </span>
                <RuleCheckStrip rules={rules} />
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={cn("h-4 w-4 shrink-0 text-ocean-sand transition-transform", expanded && "rotate-180")}
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {expanded && rules.length > 0 && (
                <div className="border-t border-ocean-mid/30 bg-ocean-deep/30 px-3 py-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-ocean-sand">
                    Strategy criteria
                  </p>
                  <RuleRequirementsList rules={rules} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </MarketDetailModal>
  );
}
