import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMarketWorkspace } from "./hooks/useMarketWorkspace";
import {
  defaultMarketMode,
  isMarketViewMode,
  marketPath,
  writeStoredMarketMode,
} from "./lib/market-routes";
import type { MarketViewMode } from "./types";
import { AssessmentTimeControl } from "./components/AssessmentTimeControl";
import { MarketSearchInput } from "./components/MarketSearchInput";
import { MarketSummaryStrip } from "./components/MarketSummaryStrip";
import { MarketViewToggle } from "./components/MarketViewToggle";
import { RuleCard } from "./components/RuleCard";
import { StrategyCard } from "./components/StrategyCard";
import { StrategyDetailModal } from "./components/StrategyDetailModal";
import { TickerCard } from "./components/TickerCard";
import { TickerDetailModal } from "./components/TickerDetailModal";

export function MarketPage() {
  const { mode: modeParam } = useParams<{ mode: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isMarketViewMode(modeParam)) {
      navigate(marketPath(defaultMarketMode()), { replace: true });
    }
  }, [modeParam, navigate]);

  const viewMode: MarketViewMode = isMarketViewMode(modeParam) ? modeParam : "strategies";

  const setViewMode = (mode: MarketViewMode) => {
    writeStoredMarketMode(mode);
    navigate(marketPath(mode));
  };

  useEffect(() => {
    if (isMarketViewMode(modeParam)) {
      writeStoredMarketMode(modeParam);
    }
  }, [modeParam]);

  const {
    loading,
    error,
    catalog,
    snapshot,
    runId,
    useMock,
    needsAssess,
    search,
    setSearch,
    threshold,
    filteredStrategyCards,
    filteredTickerCards,
    filteredRuleCards,
    selectedStrategy,
    selectedTicker,
    selectedTickerResult,
    openStrategy,
    openTicker,
    closeDetail,
    activeSignalCount,
    strategyCount,
    tickerCount,
    ruleCount,
    strategyById,
    candleCoverage,
    assessmentMode,
    assessmentAt,
    assessmentError,
    assessNotice,
    assessPending,
    refreshPending,
    setAssessmentMode,
    setAssessmentFromLocal,
    runAssessment,
    refreshResult,
    assessmentLabel,
  } = useMarketWorkspace(viewMode);

  const searchPlaceholder =
    viewMode === "strategies"
      ? "Search by strategy name"
      : viewMode === "tickers"
        ? "Search by ticker or name"
        : "Search by rule or strategy";

  const showGrids = !loading && !error;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold text-ocean-foam sm:text-2xl">Market</h1>
          <p className="mt-1 text-sm text-ocean-sand">
            Standard strategy playbooks only — activate in Admin. Dynamic screens run on Premarket.
          </p>
          {catalog && (snapshot || !useMock) && (
            <div className="mt-1">
              <MarketSummaryStrip
                strategyCount={strategyCount}
                activeSignals={activeSignalCount}
                tickerCount={tickerCount}
                ruleCount={ruleCount}
                assessmentLabel={assessmentLabel}
              />
            </div>
          )}
        </div>
        <MarketViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <MarketSearchInput
          value={search}
          onChange={setSearch}
          placeholder={searchPlaceholder}
          className="min-w-0 flex-1 sm:max-w-xs"
        />
        {candleCoverage && (
          <AssessmentTimeControl
            mode={assessmentMode}
            value={assessmentAt}
            coverage={candleCoverage}
            error={assessmentError}
            notice={assessNotice}
            pending={assessPending}
            refreshPending={refreshPending}
            onModeChange={setAssessmentMode}
            onChange={setAssessmentFromLocal}
            onAssess={runAssessment}
            onRefreshResult={() => void refreshResult()}
            className="sm:flex-1 sm:max-w-lg"
          />
        )}
      </div>

      {loading && (
        <p className="text-sm text-ocean-sand">Loading market data…</p>
      )}

      {error && (
        <p className="rounded-lg border border-ocean-danger-border bg-ocean-danger-muted px-3 py-2 text-sm text-ocean-danger">
          {error}
        </p>
      )}

      {needsAssess && (
        <p className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/30 px-3 py-2 text-sm text-ocean-sand">
          No assessment run yet. Click <strong className="text-ocean-foam">Assess</strong> to evaluate active tickers.
        </p>
      )}

      {showGrids && viewMode === "strategies" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {filteredStrategyCards.map((card) => (
            <StrategyCard
              key={card.strategy.id}
              card={card}
              threshold={threshold}
              onOpen={openStrategy}
            />
          ))}
          {filteredStrategyCards.length === 0 && search.trim() && (
            <p className="text-sm text-ocean-sand sm:col-span-2">No strategies match your search.</p>
          )}
        </div>
      )}

      {showGrids && viewMode === "tickers" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTickerCards.map((card) => (
            <TickerCard
              key={card.symbol}
              card={card}
              threshold={threshold}
              strategyById={strategyById}
              onOpen={openTicker}
            />
          ))}
          {filteredTickerCards.length === 0 && search.trim() && (
            <p className="text-sm text-ocean-sand sm:col-span-2">No tickers match your search.</p>
          )}
        </div>
      )}

      {showGrids && viewMode === "rules" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRuleCards.map((card) => (
            <RuleCard key={`${card.strategyId}:${card.ruleKey}`} card={card} />
          ))}
          {filteredRuleCards.length === 0 && search.trim() && (
            <p className="text-sm text-ocean-sand sm:col-span-2">No rules match your search.</p>
          )}
        </div>
      )}

      {selectedStrategy && (
        <StrategyDetailModal
          strategy={selectedStrategy}
          runId={runId}
          threshold={threshold}
          useMock={useMock}
          snapshot={snapshot}
          onClose={closeDetail}
        />
      )}

      {selectedTicker && (
        <TickerDetailModal
          symbol={selectedTicker}
          runId={runId}
          threshold={threshold}
          useMock={useMock}
          ticker={selectedTickerResult}
          strategyById={strategyById}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}
