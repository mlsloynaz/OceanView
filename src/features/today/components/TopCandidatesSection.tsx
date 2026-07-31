import { Link } from "react-router-dom";
import { AssessmentTimeControl } from "@/features/market/components/AssessmentTimeControl";
import { MarketSearchInput } from "@/features/market/components/MarketSearchInput";
import { TickerCard } from "@/features/market/components/TickerCard";
import { TickerDetailModal } from "@/features/market/components/TickerDetailModal";
import { useMarketWorkspace } from "@/features/market/hooks/useMarketWorkspace";
import { PremarketPage } from "@/features/premarket/PremarketPage";
import type { TodayMode } from "../lib/today-routes";
import { TodaySection } from "./TodaySection";

type LiveWorkspace = ReturnType<typeof useMarketWorkspace>;

type LiveProps = {
  ws: LiveWorkspace;
};

function LiveTopCandidates({ ws }: LiveProps) {
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

      {ws.loading ? <p className="text-sm text-ocean-sand">Loading market data…</p> : null}

      {ws.error ? (
        <p className="rounded-lg border border-ocean-danger-border bg-ocean-danger-muted px-3 py-2 text-sm text-ocean-danger">
          {ws.error}
        </p>
      ) : null}

      {ws.needsAssess ? (
        <p className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/30 px-3 py-2 text-sm text-ocean-sand">
          No assessment run yet. Use <strong className="text-ocean-foam">Assess</strong> above to
          rank live candidates. Quality % is setup completeness — not win probability.
        </p>
      ) : null}

      {!ws.loading && !ws.error ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ws.filteredTickerCards.map((card) => (
            <TickerCard
              key={card.symbol}
              card={card}
              threshold={ws.threshold}
              strategyById={ws.strategyById}
              onOpen={ws.openTicker}
            />
          ))}
          {ws.filteredTickerCards.length === 0 && ws.search.trim() ? (
            <p className="text-sm text-ocean-sand sm:col-span-2">No tickers match your search.</p>
          ) : null}
        </div>
      ) : null}

      {ws.selectedTicker ? (
        <TickerDetailModal
          symbol={ws.selectedTicker}
          runId={ws.runId}
          threshold={ws.threshold}
          useMock={ws.useMock}
          ticker={ws.selectedTickerResult}
          strategyById={ws.strategyById}
          onClose={ws.closeDetail}
        />
      ) : null}
    </>
  );
}

type Props = {
  mode: TodayMode;
  liveWorkspace: LiveWorkspace;
};

export function TopCandidatesSection({ mode, liveWorkspace }: Props) {
  if (mode === "preparation") {
    return (
      <TodaySection
        id="today-top-candidates"
        title="Top Candidates"
        subtitle="Preparation uses Premarket evaluate (dynamic strategies). Compatibility route: /premarket"
        actions={
          <Link to="/premarket" className="text-xs font-semibold text-ocean-teal hover:underline">
            Open Premarket page
          </Link>
        }
      >
        <PremarketPage />
      </TodaySection>
    );
  }

  if (mode === "replay") {
    return (
      <TodaySection
        id="today-top-candidates"
        title="Top Candidates"
        subtitle="Replay reconstructs historical assessments — use simulation time on Live for now"
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
      subtitle="Live market assessment ranked by strategy quality (not historical edge). Full Market UI remains at /market."
      actions={
        <Link to="/market/tickers" className="text-xs font-semibold text-ocean-teal hover:underline">
          Open Market page
        </Link>
      }
    >
      <LiveTopCandidates ws={liveWorkspace} />
    </TodaySection>
  );
}
