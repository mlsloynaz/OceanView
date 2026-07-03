import { MarketDetailModal } from "@/features/market/components/MarketDetailModal";
import { RuleCheckStrip } from "@/features/market/components/RuleCheckStrip";
import { RuleRequirementsList } from "@/features/market/components/RuleRequirementsList";
import type { RuleDisplayRow } from "@/features/market/types";
import { formatAchievedTimeEt, qualityBadgeClass } from "@/features/market/display";
import { cn } from "@/shared/lib/cn";
import type { PremarketStrategyGroup, PremarketTickerHit } from "../types";

type Props = {
  group: PremarketStrategyGroup;
  ticker: PremarketTickerHit;
  threshold: number;
  onClose: () => void;
};

function toDisplayRules(rules: PremarketTickerHit["rules"]): RuleDisplayRow[] {
  if (!rules?.length) return [];
  return rules.map((row) => ({
    ruleKey: row.ruleKey,
    label: row.label,
    type: row.type as RuleDisplayRow["type"],
    status: row.status as RuleDisplayRow["status"],
    metAtEt: row.metAtEt,
    evidence: row.evidence,
  }));
}

export function PremarketTickerDetailModal({ group, ticker, threshold, onClose }: Props) {
  const strategyName = group.shortName || group.name || group.strategyId;
  const rules = toDisplayRules(ticker.rules);
  const achieved = ticker.achievedAtEt?.trim()
    ? formatAchievedTimeEt(ticker.achievedAtEt)
    : null;

  return (
    <MarketDetailModal
      open
      onClose={onClose}
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          <span>{ticker.symbol}</span>
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums",
              qualityBadgeClass(ticker.qualityPct, threshold),
            )}
          >
            {ticker.qualityPct}%
          </span>
        </span>
      }
      subtitle={[ticker.name, strategyName].filter(Boolean).join(" · ")}
    >
      <div className="space-y-4">
        {achieved && (
          <p className="text-xs text-ocean-sand">
            Signal achieved at{" "}
            <strong className="text-ocean-foam">{achieved}</strong>
          </p>
        )}

        {rules.length > 0 ? (
          <>
            <RuleCheckStrip rules={rules} />
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ocean-sand">
                Rules
              </h3>
              <RuleRequirementsList rules={rules} highlightPassedTime />
            </div>
          </>
        ) : (
          <p className="text-sm text-ocean-sand">
            Rule details are not available for this run. Run evaluate again to refresh results with
            per-rule pass times.
          </p>
        )}
      </div>
    </MarketDetailModal>
  );
}
