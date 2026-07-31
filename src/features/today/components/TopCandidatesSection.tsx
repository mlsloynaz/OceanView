import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  adaptMarketTickerCards,
  adaptPremarketBestHits,
  sortCandidatesByRank,
  useTradabilityTiers,
  type CandidateViewModel,
} from "@/features/candidates";
import { CandidateDetailDrawer } from "@/features/candidates/components/CandidateDetailDrawer";
import { CandidateTable } from "@/features/candidates/components/CandidateTable";
import { AssessmentTimeControl } from "@/features/market/components/AssessmentTimeControl";
import { MarketSearchInput } from "@/features/market/components/MarketSearchInput";
import { useMarketWorkspace } from "@/features/market/hooks/useMarketWorkspace";
import { useAuth } from "@/shared/auth/AuthProvider";
import { PremarketToolbar } from "@/features/premarket/components/PremarketToolbar";
import {
  anyTickerMeetsThreshold,
  filterStrategyGroupsByThreshold,
  resolvePremarketBestHits,
} from "@/features/premarket/display";
import { usePremarketWorkspace } from "@/features/premarket/hooks/usePremarketWorkspace";
import type { TodayMode } from "../lib/today-routes";
import { TodaySection } from "./TodaySection";

type LiveWorkspace = ReturnType<typeof useMarketWorkspace>;
type PremarketWorkspace = ReturnType<typeof usePremarketWorkspace>;
type TradabilityTiers = ReturnType<typeof useTradabilityTiers>;

type Props = {
  mode: TodayMode;
  liveWorkspace: LiveWorkspace;
  premarketWorkspace: PremarketWorkspace;
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
  const candidates = useMemo(() => {
    const adapted = adaptMarketTickerCards(ws.filteredTickerCards, {
      updatedAt: ws.assessmentAt?.toISOString?.() ?? new Date().toISOString(),
      tradabilityBySymbol: tradability.bySymbol,
    });
    return sortCandidatesByRank(adapted);
  }, [ws.filteredTickerCards, ws.assessmentAt, tradability.bySymbol]);

  const selected = candidates.find((c) => c.id === selectedId) ?? null;

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
            pending={ws.assessPending}
            refreshPending={ws.refreshPending}
            monitorActive={ws.monitorActive}
            stopPending={ws.stopPending}
            canStop={ws.canStop}
            intervalValue={ws.intervalValue}
            intervalUnit={ws.intervalUnit}
            onIntervalValueChange={ws.setIntervalValue}
            onIntervalUnitChange={ws.setIntervalUnit}
            onModeChange={ws.setAssessmentMode}
            onChange={ws.setAssessmentFromLocal}
            onAssess={ws.runAssessment}
            onStartPolling={ws.startPolling}
            onStop={() => void ws.stopAssessment()}
            onRefreshResult={() => void ws.refreshResult()}
            className="min-w-0 flex-1 lg:max-w-3xl"
          />
        ) : null}
      </div>

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
          candidates={candidates}
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
        candidate={selected}
        open={Boolean(selected)}
        onClose={() => onSelect(null)}
      />
    </>
  );
}

function PreparationCandidates({
  ws,
  tradability,
  selectedId,
  onSelect,
}: {
  ws: PremarketWorkspace;
  tradability: TradabilityTiers;
  selectedId: string | null;
  onSelect: (c: CandidateViewModel | null) => void;
}) {
  const { isAdmin } = useAuth();
  const displayThreshold = ws.thresholdInput;
  const rawStrategies = ws.result?.strategies ?? [];
  const thresholdMet = anyTickerMeetsThreshold(rawStrategies, displayThreshold);

  const candidates = useMemo(() => {
    const hits = resolvePremarketBestHits(
      filterStrategyGroupsByThreshold(rawStrategies, displayThreshold),
      ws.result?.bestResults,
      10,
      displayThreshold,
    );
    const adapted = adaptPremarketBestHits(hits, {
      updatedAt: ws.result?.evaluatedAt ?? new Date().toISOString(),
      tradabilityBySymbol: tradability.bySymbol,
    });
    return sortCandidatesByRank(adapted);
  }, [
    rawStrategies,
    displayThreshold,
    ws.result?.bestResults,
    ws.result?.evaluatedAt,
    tradability.bySymbol,
  ]);

  const selected = candidates.find((c) => c.id === selectedId) ?? null;

  return (
    <>
      <PremarketToolbar
        isAdmin={isAdmin}
        result={ws.result}
        activeStrategyCount={ws.activeStrategyCount}
        evaluateGroupLabel={ws.evaluateGroupLabel}
        evaluateRunning={ws.evaluateRunning}
        canStopEvaluate={ws.canStopEvaluate}
        startPending={ws.startPending}
        stopPending={ws.stopPending}
        monitorActive={ws.monitorActive}
        intervalMinutes={ws.intervalMinutes}
        onIntervalMinutesChange={ws.setIntervalMinutes}
        loading={ws.loading}
        threshold={ws.thresholdInput}
        onThresholdChange={ws.setThresholdPct}
        assessmentMode={ws.assessmentMode}
        assessmentAt={ws.assessmentAt}
        assessmentError={ws.assessmentError}
        assessmentNotice={ws.assessmentNotice}
        coverageMin={ws.coverageBounds?.min}
        coverageMax={ws.coverageBounds?.max}
        onAssessmentModeChange={ws.setAssessmentMode}
        onAssessmentTimeChange={ws.setAssessmentFromLocal}
        onEvaluateAdhoc={() => void ws.evaluateAdhoc()}
        onStart={() => void ws.startEvaluate()}
        onStop={() => void ws.stopEvaluate()}
        onRefresh={() => void ws.refreshResult()}
      />

      <TradabilityHint tradability={tradability} />

      {ws.error ? (
        <p className="mt-3 text-sm text-ocean-danger" role="alert">
          {ws.error}
        </p>
      ) : null}

      {displayThreshold > 0 && candidates.length > 0 && !thresholdMet ? (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          No tickers reached ≥ {displayThreshold}% — showing best available.
        </p>
      ) : null}

      <div className="mt-4">
        <CandidateTable
          candidates={candidates}
          selectedId={selectedId}
          onSelect={onSelect}
          emptyMessage="No preparation candidates yet. Run Premarket evaluate to populate Top Candidates."
        />
      </div>

      <CandidateDetailDrawer
        candidate={selected}
        open={Boolean(selected)}
        onClose={() => onSelect(null)}
      />
    </>
  );
}

export function TopCandidatesSection({
  mode,
  liveWorkspace,
  premarketWorkspace,
  tradability,
  selectedId,
  onSelect,
}: Props) {
  if (mode === "preparation") {
    return (
      <TodaySection
        id="today-top-candidates"
        title="Top Candidates"
        subtitle="Preparation · Premarket evaluate adapted into CandidateViewModel. Quality ≠ historical edge."
        actions={
          <Link to="/premarket" className="text-xs font-semibold text-ocean-teal hover:underline">
            Full Premarket page
          </Link>
        }
      >
        <PreparationCandidates
          ws={premarketWorkspace}
          tradability={tradability}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </TodaySection>
    );
  }

  if (mode === "replay") {
    return (
      <TodaySection
        id="today-top-candidates"
        title="Top Candidates"
        subtitle="Replay reconstructs historical assessments — use Live + Simulate for now"
      >
        <p className="text-sm text-ocean-sand">
          Replay mode will isolate historical candles and outcome analysis. Until then, switch to{" "}
          <strong className="text-ocean-foam">Live</strong> and set Assessment to Simulate.
        </p>
      </TodaySection>
    );
  }

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
