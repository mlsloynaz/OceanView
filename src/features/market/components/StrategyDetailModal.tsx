import { Fragment, useState } from "react";
import type { MarketSnapshotFile, StrategyCatalogItem } from "../types";
import {
  isSignal,
  mergeRuleDisplay,
  qualityBadgeClass,
  strategyAchievedAtEt,
  tickersForStrategy,
} from "../display";
import { MarketDetailModal } from "./MarketDetailModal";
import { RuleCheckStrip } from "./RuleCheckStrip";
import { RuleRequirementsList } from "./RuleRequirementsList";
import { cn } from "@/shared/lib/cn";

type Props = {
  strategy: StrategyCatalogItem;
  snapshot: MarketSnapshotFile;
  onClose: () => void;
};

export function StrategyDetailModal({ strategy, snapshot, onClose }: Props) {
  const threshold = snapshot.signalThresholdPct;
  const rows = tickersForStrategy(strategy.id, snapshot, threshold);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  return (
    <MarketDetailModal
      open
      onClose={onClose}
      title={strategy.name}
      subtitle={strategy.description}
    >
      {strategy.entryWindow && (
        <p className="mb-4 text-xs text-ocean-sand">{strategy.entryWindow}</p>
      )}

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ocean-sand">
        Tickers evaluated
      </h3>

      {rows.length === 0 ? (
        <p className="text-sm text-ocean-sand">No tickers in snapshot.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-ocean-mid/40">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-ocean-mid/40 bg-ocean-deep/40 text-[11px] uppercase tracking-wide text-ocean-sand">
                <th className="px-3 py-2 font-semibold">Ticker</th>
                <th className="px-3 py-2 font-semibold">Quality</th>
                <th className="px-3 py-2 font-semibold">Criteria</th>
                <th className="px-3 py-2 font-semibold">Achieved</th>
                <th className="px-3 py-2 w-8" aria-label="Expand" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const { eval: ev } = row;
                const expanded = expandedSymbol === row.symbol;
                const rules = mergeRuleDisplay(strategy.rules, ev.rules);
                const signal = isSignal(ev.qualityPct, threshold);
                const achievedAt = signal
                  ? strategyAchievedAtEt(ev, strategy.rules)
                  : null;

                return (
                  <Fragment key={row.symbol}>
                    <tr
                      className={cn(
                        "border-b border-ocean-mid/30 last:border-0",
                        signal && "bg-ocean-teal/5",
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-ocean-foam">{row.symbol}</div>
                        {row.name && (
                          <div className="text-[11px] text-ocean-sand">{row.name}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "inline-block rounded px-2 py-0.5 text-xs font-semibold tabular-nums",
                            qualityBadgeClass(ev.qualityPct, threshold),
                          )}
                        >
                          {ev.qualityPct}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="tabular-nums text-ocean-foam">
                            {ev.metCount}/{ev.totalCount}
                          </span>
                          <RuleCheckStrip rules={rules} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {achievedAt ? (
                          <span
                            className="text-xs tabular-nums text-ocean-teal-dim dark:text-ocean-teal"
                            title="Time strategy criteria were achieved (ET)"
                          >
                            {achievedAt}
                          </span>
                        ) : (
                          <span className="text-xs text-ocean-sand/50">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSymbol(expanded ? null : row.symbol)
                          }
                          className="rounded p-1 text-ocean-sand hover:bg-ocean-mid/30"
                          aria-expanded={expanded}
                          aria-label={expanded ? "Collapse criteria" : "Expand criteria"}
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
                      </td>
                    </tr>
                    {expanded && (
                      <tr key={`${row.symbol}-detail`} className="border-b border-ocean-mid/30 bg-ocean-deep/30">
                        <td colSpan={5} className="px-3 py-3">
                          <RuleRequirementsList rules={rules} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </MarketDetailModal>
  );
}
