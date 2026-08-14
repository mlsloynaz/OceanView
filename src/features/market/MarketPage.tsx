import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMarketWorkspace } from "./hooks/useMarketWorkspace";
import {
  defaultMarketMode,
  isMarketViewMode,
  marketPath,
  writeStoredMarketMode,
} from "./lib/market-routes";
import type { MarketViewMode } from "./types";
import { MarketAlarmPanel } from "./alarm/MarketAlarmPanel";
import { AlarmTradeModal } from "./alarm/AlarmTradeModal";
import { useMarketAlarms } from "./alarm/useMarketAlarms";
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
  const alarms = useMarketAlarms();

  useEffect(() => {
    if (!isMarketViewMode(modeParam)) {
      navigate(marketPath(defaultMarketMode()), { replace: true });
    }
  }, [modeParam, navigate]);

  const viewMode: MarketViewMode = isMarketViewMode(modeParam) ? modeParam : "strategies";
  const isAlarmMode = viewMode === "alarm";

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
    monitorActive,
    stopPending,
    canStop,
    liveEnabled,
    intervalValue,
    intervalUnit,
    setIntervalValue,
    setIntervalUnit,
    setAssessmentMode,
    setAssessmentFromLocal,
    runAssessment,
    startPolling,
    stopAssessment,
    refreshResult,
    assessmentLabel,
    lastAssessmentLabel,
  } = useMarketWorkspace(viewMode);

  const searchPlaceholder =
    viewMode === "strategies"
      ? "Search by strategy name"
      : viewMode === "tickers"
        ? "Search by ticker or name"
        : "Search by rule or strategy";

  const showGrids = !isAlarmMode && !loading && !error;

  return (
    <div className="w-full space-y-4">
      <div className="space-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold text-ocean-foam sm:text-2xl">Market</h1>
          <p className="mt-1 text-sm text-ocean-sand">
            Standard strategy playbooks only — activate in Admin. Dynamic screens run on Premarket.
            Rule alarms live under the{" "}
            <Link to={marketPath("alarm")} className="text-ocean-teal hover:underline">
              Alarm
            </Link>{" "}
            tab.
          </p>
          {!isAlarmMode && catalog && (snapshot || !useMock) && (
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
        {/* Always visible on every Market mode (including Alarm) so users can switch back. */}
        <MarketViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {isAlarmMode ? (
        <MarketAlarmPanel
          watches={alarms.watches}
          tickers={alarms.tickers}
          tickersLoading={alarms.tickersLoading}
          tickersError={alarms.tickersError}
          formError={alarms.formError}
          banner={alarms.banner}
          alarmPopup={alarms.alarmPopup}
          metCount={alarms.metCount}
          runningCount={alarms.runningCount}
          timeMode={alarms.timeMode}
          simulateLocal={alarms.simulateLocal}
          lastHourScan={alarms.lastHourScan}
          lastHourScanError={alarms.lastHourScanError}
          lastHourScanBusy={alarms.lastHourScanBusy}
          monitorQueue={alarms.monitorQueue}
          monitorQueueMeta={alarms.monitorQueueMeta}
          monitorQueueLoading={alarms.monitorQueueLoading}
          monitorQueueError={alarms.monitorQueueError}
          onRefreshMonitorQueue={() => void alarms.refreshMonitorQueue()}
          onStartMonitorCandidate={alarms.startMonitorCandidate}
          onTimeModeChange={alarms.setTimeMode}
          onSimulateLocalChange={alarms.setSimulateLocal}
          onScanLastHourRth={(symbol) => void alarms.scanLastHourRth(symbol)}
          onClearLastHourScan={alarms.clearLastHourScan}
          onClearBanner={alarms.clearMetBanner}
          onClearAlarmPopup={alarms.clearAlarmPopup}
          onConfirmEnter={alarms.confirmEnter}
          onConfirmExit={alarms.confirmExit}
          onAdd={alarms.addWatch}
          onStart={alarms.startWatch}
          onStop={alarms.stopWatch}
          onStartAllIdle={alarms.startAllIdle}
          onStopAllRunning={alarms.stopAllRunning}
          onClearMetStatus={alarms.clearMetStatus}
          onClearAllMetStatuses={alarms.clearAllMetStatuses}
          onRemove={alarms.removeWatch}
          onCheckNow={(id) => void alarms.runCheckNow(id)}
          onUpdateInterval={alarms.updateWatchInterval}
          onRequestNotify={() => void alarms.requestNotifyPermission()}
        />
      ) : (
        <>
          {alarms.alarmPopup ? (
            <AlarmTradeModal
              watch={alarms.alarmPopup.watch}
              kind={alarms.alarmPopup.kind}
              onClose={alarms.clearAlarmPopup}
              onConfirm={() =>
                alarms.alarmPopup!.kind === "enter"
                  ? alarms.confirmEnter(alarms.alarmPopup!.watch.id)
                  : alarms.confirmExit(alarms.alarmPopup!.watch.id)
              }
            />
          ) : null}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <MarketSearchInput
              value={search}
              onChange={setSearch}
              placeholder={searchPlaceholder}
              className="min-w-0 w-full lg:max-w-xs"
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
                monitorActive={monitorActive}
                stopPending={stopPending}
                canStop={canStop}
                liveEnabled={liveEnabled}
                intervalValue={intervalValue}
                intervalUnit={intervalUnit}
                onIntervalValueChange={setIntervalValue}
                onIntervalUnitChange={setIntervalUnit}
                onModeChange={setAssessmentMode}
                onChange={setAssessmentFromLocal}
                onAssess={runAssessment}
                onStartPolling={startPolling}
                onStop={() => void stopAssessment()}
                onRefreshResult={() => void refreshResult()}
                className="min-w-0 flex-1 lg:max-w-3xl"
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
                  lastAssessmentLabel={lastAssessmentLabel}
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
              assessmentLabel={assessmentLabel}
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
              assessmentLabel={assessmentLabel}
              onClose={closeDetail}
            />
          )}
        </>
      )}
    </div>
  );
}
