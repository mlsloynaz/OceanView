import { useState } from "react";
import { RuleCheckStrip } from "@/features/market/components/RuleCheckStrip";
import { RuleRequirementsList } from "@/features/market/components/RuleRequirementsList";
import {
  DirectionDisplay,
  QualityDisplay,
} from "@/features/market/components/StrategyAssessMeta";
import { cn } from "@/shared/lib/cn";
import { formatAchievedTimeEt, toPremarketDisplayRules } from "../display";
import type { PremarketTickerHit } from "../types";

type Props = {
  ticker: PremarketTickerHit;
  threshold: number;
};

export function PremarketTickerRow({ ticker, threshold }: Props) {
  const [expanded, setExpanded] = useState(false);
  const rules = toPremarketDisplayRules(ticker.rules);
  const metCount = rules.filter((r) => r.status === "met").length;
  const achieved = ticker.achievedAtEt?.trim()
    ? formatAchievedTimeEt(ticker.achievedAtEt)
    : null;

  return (
    <li className="overflow-hidden rounded-lg border border-ocean-mid/40 bg-ocean-deep/20">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ocean-foam">{ticker.symbol}</div>
          {ticker.name && (
            <div className="truncate text-[11px] text-ocean-sand">{ticker.name}</div>
          )}
        </div>

        <DirectionDisplay
          direction={ticker.direction}
          directionEvidence={ticker.directionEvidence}
          directionConfidence={ticker.directionConfidence}
          compact
        />

        <QualityDisplay
          qualityPct={ticker.qualityPct}
          threshold={threshold}
          qualityPctRaw={ticker.qualityPctRaw}
          dangerPenaltyPct={ticker.dangerPenaltyPct}
        />

        {rules.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs tabular-nums text-ocean-foam">
              {metCount}/{rules.length}
            </span>
            <RuleCheckStrip rules={rules} />
          </div>
        )}

        <span
          className="hidden w-16 shrink-0 text-right text-[11px] tabular-nums text-ocean-teal-dim dark:text-ocean-teal sm:inline"
          title="Signal achieved at (ET)"
        >
          {achieved ?? "—"}
        </span>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="shrink-0 rounded p-1 text-ocean-sand hover:bg-ocean-mid/30"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse rules" : "Expand rules"}
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="border-t border-ocean-mid/30 bg-ocean-deep/30 px-3 py-3">
          {ticker.directionEvidence && (
            <p className="mb-3 text-xs leading-relaxed text-ocean-sand">{ticker.directionEvidence}</p>
          )}
          {rules.length > 0 ? (
            <RuleRequirementsList
              rules={rules}
              highlightPassedTime
              showMetrics
              showPassedTime
            />
          ) : (
            <p className="text-xs text-ocean-sand">
              Rule details are not available for this run. Evaluate again to refresh per-rule results.
            </p>
          )}
        </div>
      )}
    </li>
  );
}
