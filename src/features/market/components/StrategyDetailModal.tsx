import { Fragment, useEffect, useState } from "react";
import { fetchStrategyDetail } from "../api/market-client";
import type {
  MarketSnapshotFile,
  StrategyCatalogItem,
  StrategyDetailRow,
} from "../types";
import {
  formatAchievedTimeEt,
  formatEntryWindow,
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
  runId: string | null;
  threshold: number;
  useMock: boolean;
  snapshot: MarketSnapshotFile | null;
  onClose: () => void;
};

type RowModel = {
  symbol: string;
  name: string | null;
  qualityPct: number;
  metCount: number;
  totalCount: number;
  achievedAt: string | null;
  rules: ReturnType<typeof mergeRuleDisplay>;
};

function mapDetailRow(
  row: StrategyDetailRow,
  strategyId: string,
  catalogRules: StrategyCatalogItem["rules"],
): RowModel {
  const rules =
    row.rules.length > 0 && row.rules[0]?.label
      ? row.rules
      : mergeRuleDisplay(catalogRules, row.rules);
  const evalRow = {
    strategyId,
    qualityPct: row.qualityPct,
    direction: row.direction,
    metCount: row.metCount,
    totalCount: row.totalCount,
    metRequired: row.metRequired ?? 0,
    totalRequired: row.totalRequired ?? 0,
    achievedAtEt: row.achievedAtEt,
    rules: row.rules.map((r) => ({
      ruleKey: r.ruleKey,
      status: r.status,
      metAtEt: r.metAtEt,
      evidence: r.evidence,
    })),
  };
  const achievedAt = row.achievedAtEt
    ? formatAchievedTimeEt(String(row.achievedAtEt))
    : strategyAchievedAtEt(evalRow, catalogRules);

  return {
    symbol: row.symbol,
    name: row.name,
    qualityPct: row.qualityPct,
    metCount: row.metCount,
    totalCount: row.totalCount,
    achievedAt,
    rules,
  };
}

export function StrategyDetailModal({
  strategy,
  runId,
  threshold,
  useMock,
  snapshot,
  onClose,
}: Props) {
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [rows, setRows] = useState<RowModel[]>([]);
  const [loading, setLoading] = useState(!useMock);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (useMock && snapshot) {
      const mockRows = tickersForStrategy(strategy.id, snapshot, threshold);
      setRows(
        mockRows.map((row) => {
          const rules = mergeRuleDisplay(strategy.rules, row.eval.rules);
          const signal = isSignal(row.eval.qualityPct, threshold);
          return {
            symbol: row.symbol,
            name: row.name,
            qualityPct: row.eval.qualityPct,
            metCount: row.eval.metCount,
            totalCount: row.eval.totalCount,
            achievedAt: signal ? strategyAchievedAtEt(row.eval, strategy.rules) : null,
            rules,
          };
        }),
      );
      setLoading(false);
      return;
    }

    if (!runId) {
      setRows([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchStrategyDetail(strategy.id, runId)
      .then((detail) => {
        if (cancelled) return;
        setRows(detail.rows.map((row) => mapDetailRow(row, strategy.id, strategy.rules)));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load strategy detail.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [useMock, snapshot, strategy, runId, threshold]);

  const entryWindowLabel = formatEntryWindow(strategy.entryWindow);

  return (
    <MarketDetailModal
      open
      onClose={onClose}
      title={strategy.name}
      subtitle={strategy.description}
    >
      {entryWindowLabel && (
        <p className="mb-4 text-xs text-ocean-sand">{entryWindowLabel}</p>
      )}

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ocean-sand">
        Tickers evaluated
      </h3>

      {loading && <p className="text-sm text-ocean-sand">Loading detail…</p>}

      {error && (
        <p className="rounded-lg border border-ocean-danger-border bg-ocean-danger-muted px-3 py-2 text-sm text-ocean-danger">
          {error}
        </p>
      )}

      {!loading && !error && rows.length === 0 ? (
        <p className="text-sm text-ocean-sand">No tickers in snapshot.</p>
      ) : null}

      {!loading && !error && rows.length > 0 && (
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
                const expanded = expandedSymbol === row.symbol;
                const signal = isSignal(row.qualityPct, threshold);

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
                            qualityBadgeClass(row.qualityPct, threshold),
                          )}
                        >
                          {row.qualityPct}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="tabular-nums text-ocean-foam">
                            {row.metCount}/{row.totalCount}
                          </span>
                          <RuleCheckStrip rules={row.rules} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {row.achievedAt ? (
                          <span
                            className="text-xs tabular-nums text-ocean-teal-dim dark:text-ocean-teal"
                            title="Time strategy criteria were achieved (ET)"
                          >
                            {row.achievedAt}
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
                          <RuleRequirementsList rules={row.rules} />
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
