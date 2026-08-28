import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  adaptMarketTickerCards,
  sortCandidatesByRank,
  useTradabilityTiers,
  type CandidateViewModel,
} from "@/features/candidates";
import { CandidateDetailDrawer } from "@/features/candidates/components/CandidateDetailDrawer";
import { CandidateTable } from "@/features/candidates/components/CandidateTable";
import { applyExitCheckToCandidate } from "@/features/candidates/lib/exitOverlay";
import {
  checkPositionExit,
  MarketExitApiError,
} from "@/features/market/api/exit-client";
import { AssessmentTimeControl } from "@/features/market/components/AssessmentTimeControl";
import { MarketSearchInput } from "@/features/market/components/MarketSearchInput";
import { useMarketWorkspace } from "@/features/market/hooks/useMarketWorkspace";
import { formatSimulationTimeEt } from "@/features/market/lib/assessment-time";
import { TodaySection } from "./TodaySection";

type LiveWorkspace = ReturnType<typeof useMarketWorkspace>;
type TradabilityTiers = ReturnType<typeof useTradabilityTiers>;

type Props = {
  liveWorkspace: LiveWorkspace;
  tradability: TradabilityTiers;
  selectedId: string | null;
  onSelect: (candidate: CandidateViewModel | null) => void;
};

function TradabilityHint({ tradability }: { tradability: TradabilityTiers }) {
  if (tradability.loading) {
    return <p className="mb-3 text-xs text-ocean-sand">Loading option tradability…</p>;
  }
  if (tradability.error) {
    return (
      <p className="mb-3 rounded-lg border border-ocean-danger-border bg-ocean-danger-muted px-3 py-2 text-sm text-ocean-danger">
        Tradability unavailable: {tradability.error}
      </p>
    );
  }
  if (tradability.empty) {
    return (
      <p className="mb-3 rounded-lg border border-ocean-mid/40 bg-ocean-deep/30 px-3 py-2 text-sm text-ocean-sand">
        Option tradability is <strong className="text-ocean-foam">Unknown</strong> until samples
        exist. Run{" "}
        <Link to="/universe#tradable" className="font-semibold text-ocean-teal hover:underline">
          Universe → Tradable → Collect
        </Link>{" "}
        (≥8 samples per symbol).
      </p>
    );
  }
  if (tradability.readyCount > 0) {
    return (
      <p className="mb-3 text-xs text-ocean-sand">
        Tradability: {tradability.readyCount}/{tradability.sourceCount || "?"} symbols ready
        {Object.keys(tradability.bySymbol).length
          ? ` · ${Object.keys(tradability.bySymbol).length} scored`
          : ""}
      </p>
    );
  }
  return null;
}

function useExitOverlays(
  baseCandidates: CandidateViewModel[],
  opts: {
    simulateMode: boolean;
    assessmentAt: Date | null | undefined;
    /** Changes when a new Assess (or poll tick) finishes — triggers bulk exit refresh. */
    assessFingerprint: string | null;
    onSelect: (candidate: CandidateViewModel | null) => void;
    selectedId: string | null;
  },
) {
  const [overlays, setOverlays] = useState<Record<string, CandidateViewModel>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lastFingerprintRef = useRef<string | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const candidates = useMemo(() => {
    return baseCandidates.map((row) => overlays[row.id] ?? row);
  }, [baseCandidates, overlays]);

  const selected = candidates.find((c) => c.id === opts.selectedId) ?? null;

  const runExitFor = useCallback(async (candidate: CandidateViewModel) => {
    const o = optsRef.current;
    if (candidate.direction !== "CALL" && candidate.direction !== "PUT") {
      throw new Error("Exit check needs CALL or PUT direction");
    }
    const simulating = o.simulateMode && o.assessmentAt;
    const result = await checkPositionExit({
      symbol: candidate.symbol,
      direction: candidate.direction,
      strategyId: candidate.strategyId,
      entryPrice: candidate.movementProfile?.sequenceEntryPrice ?? null,
      refreshCandles: false,
      simulationTimeEt: simulating
        ? formatSimulationTimeEt(o.assessmentAt as Date)
        : undefined,
      force: !simulating,
    });
    return applyExitCheckToCandidate(candidate, result);
  }, []);

  const testExit = useCallback(
    async (candidate: CandidateViewModel) => {
      if (candidate.direction !== "CALL" && candidate.direction !== "PUT") {
        setError("Exit test needs CALL or PUT direction on the candidate.");
        return;
      }
      setPendingId(candidate.id);
      setError(null);
      setNotice(null);
      try {
        const next = await runExitFor(candidate);
        setOverlays((prev) => ({ ...prev, [candidate.id]: next }));
        if (optsRef.current.selectedId === candidate.id) {
          optsRef.current.onSelect(next);
        }
        if (next.exitMonitor?.exitSuggested) {
          setNotice(`${candidate.symbol}: Exit suggested`);
        } else if (next.exitMonitor?.severity === "warn") {
          setNotice(`${candidate.symbol}: Exit watch`);
        } else if (next.exitMonitor?.paused) {
          setNotice(next.exitMonitor.message || "Exit check paused (market hours)");
        } else {
          setNotice(`${candidate.symbol}: exit clear (no warn)`);
        }
      } catch (err) {
        const msg =
          err instanceof MarketExitApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Exit check failed";
        setError(msg);
      } finally {
        setPendingId(null);
      }
    },
    [runExitFor],
  );

  const refreshExitsForAssess = useCallback(
    async (rows: CandidateViewModel[]) => {
      const tradeable = rows.filter(
        (r) => r.direction === "CALL" || r.direction === "PUT",
      );
      // Cap cost on poll: top ranked CALL/PUT only.
      const batch = tradeable.slice(0, 8);
      if (batch.length === 0) {
        setOverlays({});
        setNotice(null);
        return;
      }
      setBulkPending(true);
      setError(null);
      try {
        const nextMap: Record<string, CandidateViewModel> = {};
        let suggested = 0;
        let watch = 0;
        // Sequential — avoids hammering /market/exit/check on each Assess tick.
        for (const row of batch) {
          try {
            const next = await runExitFor(row);
            nextMap[row.id] = next;
            if (next.exitMonitor?.exitSuggested) suggested += 1;
            else if (next.exitMonitor?.severity === "warn") watch += 1;
          } catch (err) {
            console.warn("exit check failed", row.symbol, err);
          }
        }
        setOverlays(nextMap);
        const parts = [`Exit checked ${Object.keys(nextMap).length}/${batch.length}`];
        if (suggested) parts.push(`${suggested} exit suggested`);
        if (watch) parts.push(`${watch} exit watch`);
        setNotice(parts.join(" · "));
        const selId = optsRef.current.selectedId;
        if (selId && nextMap[selId]) {
          optsRef.current.onSelect(nextMap[selId]!);
        }
      } finally {
        setBulkPending(false);
      }
    },
    [runExitFor],
  );

  useEffect(() => {
    const fp = opts.assessFingerprint;
    if (!fp || fp === lastFingerprintRef.current) return;
    if (baseCandidates.length === 0) return;
    lastFingerprintRef.current = fp;
    void refreshExitsForAssess(baseCandidates);
  }, [opts.assessFingerprint, baseCandidates, refreshExitsForAssess]);

  return {
    candidates,
    selected,
    testExit,
    pendingId,
    bulkPending,
    error,
    notice,
    clearError: () => setError(null),
    setError,
  };
}

function LiveCandidates({
  ws,
  tradability,
  selectedId,
  onSelect,
}: {
  ws: LiveWorkspace;
  tradability: TradabilityTiers;
  selectedId: string | null;
  onSelect: (c: CandidateViewModel | null) => void;
}) {
  const baseCandidates = useMemo(() => {
    const adapted = adaptMarketTickerCards(ws.filteredTickerCards, {
      updatedAt: ws.assessmentAt?.toISOString?.() ?? new Date().toISOString(),
      tradabilityBySymbol: tradability.bySymbol,
    });
    return sortCandidatesByRank(adapted);
  }, [ws.filteredTickerCards, ws.assessmentAt, tradability.bySymbol]);

  const simulateMode = ws.assessmentMode === "et";
  const assessFingerprint = useMemo(() => {
    if (!ws.runId) return null;
    // Include card symbols so poll refreshes re-run exit when the set changes.
    const keys = baseCandidates
      .slice(0, 8)
      .map((c) => `${c.symbol}:${c.direction}`)
      .join(",");
    return `${ws.runId}|${ws.lastAssessmentLabel ?? ""}|${simulateMode ? "et" : "now"}|${keys}`;
  }, [ws.runId, ws.lastAssessmentLabel, simulateMode, baseCandidates]);

  const exit = useExitOverlays(baseCandidates, {
    simulateMode,
    assessmentAt: ws.assessmentAt,
    assessFingerprint,
    onSelect,
    selectedId,
  });

  const simulationLabel =
    simulateMode && ws.assessmentAt
      ? ws.assessmentAt.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : null;

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <MarketSearchInput
          value={ws.search}
          onChange={ws.setSearch}
          placeholder="Search by ticker or name"
          className="min-w-0 w-full lg:max-w-xs"
        />
        {ws.candleCoverage ? (
          <AssessmentTimeControl
            mode={ws.assessmentMode}
            value={ws.assessmentAt}
            coverage={ws.candleCoverage}
            error={ws.assessmentError}
            notice={ws.assessNotice}
            pending={ws.assessPending || exit.bulkPending}
            refreshPending={ws.refreshPending}
            monitorActive={ws.monitorActive}
            stopPending={ws.stopPending}
            canStop={ws.canStop}
            liveEnabled={ws.liveEnabled}
            intervalValue={ws.intervalValue}
            intervalUnit={ws.intervalUnit}
            onIntervalValueChange={ws.setIntervalValue}
            onIntervalUnitChange={ws.setIntervalUnit}
            tickerScope={ws.tickerScope}
            onTickerScopeChange={ws.setTickerScope}
            onModeChange={ws.setAssessmentMode}
            onChange={ws.setAssessmentFromLocal}
            onAssess={ws.runAssessment}
            onStartPolling={ws.startPolling}
            onStop={() => void ws.stopAssessment()}
            onRefreshResult={() => void ws.refreshResult()}
            onTestExit={() => {
              if (!exit.selected) {
                exit.setError(
                  "Select a Top Candidate row to re-check exit only (Assess already runs exit for the top list).",
                );
                return;
              }
              void exit.testExit(exit.selected);
            }}
            testExitPending={Boolean(exit.pendingId) || exit.bulkPending}
            testExitDisabled={
              Boolean(exit.pendingId) ||
              exit.bulkPending ||
              (Boolean(exit.selected) &&
                exit.selected!.direction !== "CALL" &&
                exit.selected!.direction !== "PUT")
            }
            testExitTitle={
              !exit.selected
                ? "Optional: select one row to re-run exit only. Assess/poll already exit-checks the top list."
                : exit.selected.direction !== "CALL" && exit.selected.direction !== "PUT"
                  ? "Selected candidate needs CALL or PUT direction"
                  : "Re-run exit-check for the selected candidate only"
            }
            className="min-w-0 flex-1 lg:max-w-3xl"
          />
        ) : null}
      </div>

      {exit.error ? (
        <p className="mb-3 text-xs text-ocean-danger" role="alert">
          {exit.error}
        </p>
      ) : null}
      {!exit.error && exit.notice ? (
        <p className="mb-3 text-xs text-ocean-teal-dim dark:text-ocean-teal">{exit.notice}</p>
      ) : null}

      <TradabilityHint tradability={tradability} />

      {ws.loading ? <p className="text-sm text-ocean-sand">Loading market data…</p> : null}

      {ws.error ? (
        <p className="rounded-lg border border-ocean-danger-border bg-ocean-danger-muted px-3 py-2 text-sm text-ocean-danger">
          {ws.error}
        </p>
      ) : null}

      {ws.envelope?.paused || ws.envelope?.marketOpen === false ? (
        <p className="mb-3 rounded-lg border border-ocean-sand/40 bg-ocean-sand/10 px-3 py-2 text-sm text-ocean-foam">
          {ws.envelope.message || "I am sorry wait for Market hours"}
        </p>
      ) : null}

      {ws.needsAssess ? (
        <p className="mb-3 rounded-lg border border-ocean-mid/40 bg-ocean-deep/30 px-3 py-2 text-sm text-ocean-sand">
          No assessment run yet. Use <strong className="text-ocean-foam">Assess</strong> above to
          rank live candidates. Quality is setup completeness — Historical edge stays empty until
          outcomes exist.
        </p>
      ) : null}

      {!ws.loading && !ws.error ? (
        <CandidateTable
          candidates={exit.candidates}
          selectedId={selectedId}
          onSelect={onSelect}
          emptyMessage={
            ws.search.trim()
              ? "No tickers match your search."
              : "No market candidates yet. Run Assess to populate the table."
          }
        />
      ) : null}

      <CandidateDetailDrawer
        candidate={exit.selected}
        open={Boolean(exit.selected)}
        onClose={() => onSelect(null)}
        simulateMode={simulateMode}
        simulationLabel={simulationLabel}
        exitTestPending={exit.pendingId === exit.selected?.id}
        exitTestError={exit.error}
        onTestExit={
          exit.selected
            ? () => {
                void exit.testExit(exit.selected!);
              }
            : undefined
        }
      />
    </>
  );
}

export function TopCandidatesSection({
  liveWorkspace,
  tradability,
  selectedId,
  onSelect,
}: Props) {
  return (
    <TodaySection
      id="today-top-candidates"
      title="Top Candidates"
      subtitle="Live market assessment as CandidateViewModel. Historical edge stays blank until outcomes exist."
      actions={
        <Link to="/market/tickers" className="text-xs font-semibold text-ocean-teal hover:underline">
          Open Market page
        </Link>
      }
    >
      <LiveCandidates
        ws={liveWorkspace}
        tradability={tradability}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </TodaySection>
  );
}

