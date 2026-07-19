import { useEffect, useState } from "react";
import { fetchTickerDetail } from "../api/market-client";
import type { EntryWindow } from "../lib/entry-window";
import { formatEntryWindow } from "../lib/entry-window";
import type { StrategyCatalogItem, TickerEvalResult } from "../types";
import {
  isSignal,
  mergeRuleDisplay,
} from "../display";
import {
  formatMoneyPrice,
  resolveEstimatedExitPrice,
} from "@/features/premarket/display";
import { MarketDetailModal } from "./MarketDetailModal";
import { RuleCheckStrip } from "./RuleCheckStrip";
import { RuleRequirementsList } from "./RuleRequirementsList";
import {
  DirectionDisplay,
  DangersPanel,
  QualityDisplay,
} from "./StrategyAssessMeta";
import { cn } from "@/shared/lib/cn";
import type { StrategyAssessExtras } from "../types";

type Props = {
  symbol: string;
  runId: string | null;
  threshold: number;
  useMock: boolean;
  ticker: TickerEvalResult | null;
  strategyById: Map<string, StrategyCatalogItem>;
  onClose: () => void;
};

type StrategyRow = StrategyAssessExtras & {
  strategyId: string;
  name: string;
  entryWindow?: EntryWindow;
  qualityPct: number;
  rules: ReturnType<typeof mergeRuleDisplay>;
};

export function TickerDetailModal({
  symbol,
  runId,
  threshold,
  useMock,
  ticker,
  strategyById,
  onClose,
}: Props) {
  const [rows, setRows] = useState<StrategyRow[]>([]);
  const [titleName, setTitleName] = useState<string | null>(ticker?.name ?? null);
  const [movementProfile, setMovementProfile] = useState(ticker?.movementProfile ?? null);
  const [loading, setLoading] = useState(!useMock);
  const [error, setError] = useState<string | null>(null);
  const [expandedStrategyId, setExpandedStrategyId] = useState<string | null>(null);

  useEffect(() => {
    if (useMock && ticker) {
      const sorted = [...ticker.strategies].sort((a, b) => b.qualityPct - a.qualityPct);
      setRows(
        sorted.map((ev) => {
          const catalog = strategyById.get(ev.strategyId);
          return {
            strategyId: ev.strategyId,
            name: catalog?.name ?? ev.strategyId,
            entryWindow: catalog?.entryWindow,
            qualityPct: ev.qualityPct,
            direction: ev.direction,
            directionEvidence: ev.directionEvidence,
            directionConfidence: ev.directionConfidence,
            qualityPctRaw: ev.qualityPctRaw,
            dangerPenaltyPct: ev.dangerPenaltyPct,
            dangers: ev.dangers,
            rules: catalog ? mergeRuleDisplay(catalog.rules, ev.rules) : [],
          };
        }),
      );
      setTitleName(ticker.name);
      setMovementProfile(ticker.movementProfile ?? null);
      setExpandedStrategyId(
        sorted.find((s) => isSignal(s.qualityPct, threshold))?.strategyId ??
          sorted[0]?.strategyId ??
          null,
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
    void fetchTickerDetail(symbol, runId)
      .then((detail) => {
        if (cancelled) return;
        setTitleName(detail.name);
        setMovementProfile(detail.movementProfile ?? null);
        const sorted = [...detail.strategies].sort((a, b) => b.qualityPct - a.qualityPct);
        setRows(
          sorted.map((ev) => {
            const catalog = strategyById.get(ev.strategyId);
            const rules =
              ev.rules.length > 0 && ev.rules[0]?.label
                ? ev.rules
                : catalog
                  ? mergeRuleDisplay(catalog.rules, ev.rules)
                  : [];
            return {
              strategyId: ev.strategyId,
              name: catalog?.name ?? ev.strategyId,
              entryWindow: catalog?.entryWindow,
              qualityPct: ev.qualityPct,
              direction: ev.direction,
              directionEvidence: ev.directionEvidence,
              directionConfidence: ev.directionConfidence,
              qualityPctRaw: ev.qualityPctRaw,
              dangerPenaltyPct: ev.dangerPenaltyPct,
              dangers: ev.dangers,
              rules,
            };
          }),
        );
        setExpandedStrategyId(
          sorted.find((s) => isSignal(s.qualityPct, threshold))?.strategyId ??
            sorted[0]?.strategyId ??
            null,
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load ticker detail.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [useMock, ticker, symbol, runId, threshold, strategyById]);

  const estimatedExit = resolveEstimatedExitPrice({
    profile: movementProfile,
    dangers: rows[0]?.dangers,
  });

  return (
    <MarketDetailModal
      open
      onClose={onClose}
      title={symbol}
      subtitle={titleName ?? undefined}
    >
      {estimatedExit != null && (
        <p className="mb-4 text-sm text-ocean-sand">
          Estimated exit{" "}
          <strong className="tabular-nums text-ocean-foam">
            {formatMoneyPrice(estimatedExit)}
          </strong>
        </p>
      )}

      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ocean-sand">
        Strategies evaluated
      </h3>

      {loading && <p className="text-sm text-ocean-sand">Loading detail…</p>}

      {error && (
        <p className="rounded-lg border border-ocean-danger-border bg-ocean-danger-muted px-3 py-2 text-sm text-ocean-danger">
          {error}
        </p>
      )}

      {!loading && !error && (
        <ul className="space-y-2">
          {rows.map((ev) => {
            const expanded = expandedStrategyId === ev.strategyId;
            const signal = isSignal(ev.qualityPct, threshold);
            const entryWindowLabel = formatEntryWindow(ev.entryWindow);

            return (
              <li
                key={ev.strategyId}
                className={cn(
                  "rounded-lg border border-ocean-mid/40",
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
                      <span className="font-medium text-ocean-foam">{ev.name}</span>
                      <DirectionDisplay
                        direction={ev.direction}
                        directionEvidence={ev.directionEvidence}
                        directionConfidence={ev.directionConfidence}
                        compact
                      />
                    </div>
                    {entryWindowLabel && (
                      <p className="mt-0.5 text-[11px] text-ocean-sand">{entryWindowLabel}</p>
                    )}
                  </div>
                  <QualityDisplay
                    qualityPct={ev.qualityPct}
                    threshold={threshold}
                    qualityPctRaw={ev.qualityPctRaw}
                    dangerPenaltyPct={ev.dangerPenaltyPct}
                  />
                  <RuleCheckStrip rules={ev.rules} />
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

                {expanded && (
                  <div className="border-t border-ocean-mid/30 bg-ocean-deep/30 px-3 py-3 space-y-3">
                    {ev.directionEvidence && (
                      <p className="text-xs leading-relaxed text-ocean-sand">{ev.directionEvidence}</p>
                    )}
                    <DangersPanel dangers={ev.dangers} />
                    {ev.rules.length > 0 && (
                      <>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-ocean-sand">
                          Strategy criteria
                        </p>
                        <RuleRequirementsList rules={ev.rules} />
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </MarketDetailModal>
  );
}
