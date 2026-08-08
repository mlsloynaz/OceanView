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
  strategyAchievedAtEt,
  tickersForStrategy,
} from "../display";
import { formatAssessmentDisplay } from "../lib/assessment-time";
import { MarketDetailModal } from "./MarketDetailModal";
import { RuleCheckStrip } from "./RuleCheckStrip";
import { RuleRequirementsList } from "./RuleRequirementsList";
import { DirectionDisplay, DangersPanel, QualityDisplay } from "./StrategyAssessMeta";
import type { StrategyAssessExtras } from "../types";
import { cn } from "@/shared/lib/cn";

type Props = {
  strategy: StrategyCatalogItem;
  runId: string | null;
  threshold: number;
  useMock: boolean;
  snapshot: MarketSnapshotFile | null;
  /** Fallback label from the Market workspace (e.g. "Assessed Jul 29, 10:00 AM EDT"). */
  assessmentLabel?: string | null;
  onClose: () => void;
};

type RowModel = StrategyAssessExtras & {
  symbol: string;
  name: string | null;
  qualityPct: number;
  metCount: number;
  totalCount: number;
  metRequired: number;
  totalRequired: number;
  achievedAt: string | null;
  rules: ReturnType<typeof mergeRuleDisplay>;
};

function mapDetailRow(
  row: StrategyDetailRow,
  _strategyId: string,
  catalogRules: StrategyCatalogItem["rules"],
): RowModel {
  const rules =
    row.rules.length > 0 && row.rules[0]?.label
      ? row.rules
      : mergeRuleDisplay(catalogRules, row.rules);
  // Achieved = when the *strategy* became a signal — never a single rule's metAt
  // (e.g. prior BB mid anchored at 3:00 PM on an earlier day).
  const achievedAt =
    row.achievedAtEt != null && String(row.achievedAtEt).trim()
      ? formatAchievedTimeEt(String(row.achievedAtEt))
      : null;

  return {
    symbol: row.symbol,
    name: row.name,
    qualityPct: row.qualityPct,
    direction: row.direction,
    directionEvidence: row.directionEvidence,
    directionConfidence: row.directionConfidence,
    qualityPctRaw: row.qualityPctRaw,
    dangerPenaltyPct: row.dangerPenaltyPct,
    dangers: row.dangers,
    metCount: row.metCount,
    totalCount: row.totalCount,
    metRequired: row.metRequired ?? 0,
    totalRequired: row.totalRequired ?? 0,
    achievedAt,
    rules,
  };
}

function formatAssessmentMeta(
  simulationTimeEt?: string | null,
  evaluatedAt?: string | null,
  fallbackLabel?: string | null,
): string | null {
  const raw = (simulationTimeEt || evaluatedAt || "").trim();
  if (raw) {
    const asOf = new Date(raw);
    if (!Number.isNaN(asOf.getTime())) {
      return `Assessment ${formatAssessmentDisplay(asOf)}`;
    }
  }
  const fallback = (fallbackLabel || "").trim();
  return fallback || null;
}

export function StrategyDetailModal({
  strategy,
  runId,
  threshold,
  useMock,
  snapshot,
  assessmentLabel,
  onClose,
}: Props) {
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [rows, setRows] = useState<RowModel[]>([]);
  const [assessmentAtLabel, setAssessmentAtLabel] = useState<string | null>(
    assessmentLabel ?? null,
  );
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
            direction: row.eval.direction,
            directionEvidence: row.eval.directionEvidence,
            directionConfidence: row.eval.directionConfidence,
            qualityPctRaw: row.eval.qualityPctRaw,
            dangerPenaltyPct: row.eval.dangerPenaltyPct,
            dangers: row.eval.dangers,
            metCount: row.eval.metCount,
            totalCount: row.eval.totalCount,
            metRequired: row.eval.metRequired ?? 0,
            totalRequired: row.eval.totalRequired ?? 0,
            achievedAt: signal ? strategyAchievedAtEt(row.eval, strategy.rules) : null,
            rules,
          };
        }),
      );
      setAssessmentAtLabel(
        formatAssessmentMeta(null, snapshot.evaluatedAt, assessmentLabel),
      );
      setLoading(false);
      return;
    }

    if (!runId) {
      setRows([]);
      setAssessmentAtLabel(assessmentLabel ?? null);
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
        setAssessmentAtLabel(
          formatAssessmentMeta(detail.simulationTimeEt, detail.evaluatedAt, assessmentLabel),
        );
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
  }, [useMock, snapshot, strategy, runId, threshold, assessmentLabel]);

  const entryWindowLabel = formatEntryWindow(strategy.entryWindow);

  return (
    <MarketDetailModal
      open
      onClose={onClose}
      title={strategy.name}
      meta={assessmentAtLabel}
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
                <th className="px-3 py-2 font-semibold">Dir</th>
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
                        <DirectionDisplay
                          direction={row.direction}
                          directionEvidence={row.directionEvidence}
                          directionConfidence={row.directionConfidence}
                          compact
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <QualityDisplay
                          qualityPct={row.qualityPct}
                          threshold={threshold}
                          qualityPctRaw={row.qualityPctRaw}
                          dangerPenaltyPct={row.dangerPenaltyPct}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span
                            className="tabular-nums text-ocean-foam"
                            title="Required rules met (extra rules excluded from score)"
                          >
                            {row.totalRequired != null && row.totalRequired > 0
                              ? `${row.metRequired ?? row.metCount}/${row.totalRequired}`
                              : `${row.metCount}/${row.totalCount}`}
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
                        <td colSpan={6} className="px-3 py-3 space-y-3">
                          {row.directionEvidence && (
                            <p className="text-xs leading-relaxed text-ocean-sand">{row.directionEvidence}</p>
                          )}
                          <DangersPanel dangers={row.dangers} />
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
