import { Link } from "react-router-dom";
import { useStrategiesPane } from "@/features/admin/strategies/hooks/useStrategiesPane";
import { PremarketAuxPanels } from "./components/PremarketAuxPanels";
import { PremarketBanner } from "./components/PremarketBanner";
import { PremarketEmptyState } from "./components/PremarketEmptyState";
import { PremarketStrategySection } from "./components/PremarketStrategySection";
import { PremarketToolbar } from "./components/PremarketToolbar";
import { usePremarketWorkspace } from "./hooks/usePremarketWorkspace";

export function PremarketPage() {
  const ws = usePremarketWorkspace();
  const builder = useStrategiesPane();

  const resultStrategies = ws.result?.strategies ?? [];
  const hasResults = resultStrategies.length > 0;
  const showEmpty =
    !ws.loading && !ws.startPending && !hasResults && !ws.error && !ws.useMock;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ocean-foam">Premarket</h1>
        <p className="mt-2 text-ocean-sand">
          Evaluate active dynamic strategies against active tickers. Open{" "}
          <strong className="font-medium text-ocean-foam">Strategy builder</strong> from the
          thumbnails below, or manage the full catalog in{" "}
          <Link to="/admin" className="text-ocean-teal hover:underline">
            Admin
          </Link>
          . Extended-hours bars stay in memory only.
        </p>
      </div>

      {ws.catalogError && (
        <p className="text-sm text-ocean-danger" role="alert">
          {ws.catalogError}
        </p>
      )}

      {!ws.catalogLoading && ws.activeStrategies.length === 0 && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          No active strategies — create or activate one in{" "}
          <strong className="font-medium">Strategy builder</strong> below or in{" "}
          <Link to="/admin" className="font-medium underline hover:text-ocean-foam">
            Admin → Dynamic strategies
          </Link>
          .
        </p>
      )}

      <PremarketBanner />

      <PremarketAuxPanels
        ws={ws}
        builder={builder}
        onStrategyMutated={() => void ws.reloadCatalog()}
      />

      <PremarketToolbar
        result={ws.result}
        activeStrategyCount={ws.activeStrategies.length}
        evaluateRunning={ws.evaluateRunning}
        canStopEvaluate={ws.canStopEvaluate}
        startPending={ws.startPending}
        stopPending={ws.stopPending}
        loading={ws.loading}
        threshold={ws.thresholdInput}
        onThresholdChange={ws.setThresholdPct}
        assessmentMode={ws.assessmentMode}
        assessmentAt={ws.assessmentAt}
        assessmentError={ws.assessmentError}
        onAssessmentModeChange={ws.setAssessmentMode}
        onAssessmentTimeChange={ws.setAssessmentFromLocal}
        onStart={() => void ws.startEvaluate()}
        onStop={() => void ws.stopEvaluate()}
        onRefresh={() => void ws.refreshResult()}
      />

      {(ws.notice || builder.notice) && (
        <p className="text-sm text-ocean-teal-dim dark:text-ocean-teal" role="status">
          {builder.notice ?? ws.notice}
        </p>
      )}
      {ws.error && (
        <p className="text-sm text-ocean-danger" role="alert">
          {ws.error}
        </p>
      )}

      {ws.loading && !ws.result && !ws.startPending && (
        <p className="text-sm text-ocean-sand">Loading last evaluate result…</p>
      )}

      {ws.startPending && (
        <p className="text-sm text-ocean-sand">
          Evaluating active tickers against {ws.activeStrategies.length} active strateg
          {ws.activeStrategies.length === 1 ? "y" : "ies"}…
        </p>
      )}

      {hasResults && (
        <div className="space-y-4">
          {ws.result?.summary && (
            <p className="text-xs text-ocean-sand">
              {ws.result.summary.symbolsAboveThreshold ?? 0} hit(s) at ≥ {ws.threshold}%
              {" · "}
              {ws.result.summary.strategyCount ?? resultStrategies.length} strateg
              {(ws.result.summary.strategyCount ?? resultStrategies.length) === 1 ? "y" : "ies"}
              {" · "}
              {ws.result.summary.symbolsTotal ?? "—"} symbols evaluated
            </p>
          )}
          {resultStrategies.map((group) => (
            <PremarketStrategySection
              key={`${group.strategyId}-${group.name ?? ""}`}
              group={group}
              threshold={ws.threshold}
            />
          ))}
        </div>
      )}

      {showEmpty && (
        <PremarketEmptyState hasActiveStrategies={ws.activeStrategies.length > 0} />
      )}

      {hasResults && ws.threshold > 0 && (ws.result?.summary?.symbolsAboveThreshold ?? 0) === 0 && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          No tickers reached ≥ {ws.threshold}% quality — click a ticker chip below to see per-rule
          evidence. Volatility often reads <strong>not met</strong> at the open until BB width and
          ATR expand (need index ≥ 1.35 and ATR ratio ≥ 1.20 on 15m).
        </p>
      )}

      {!hasResults && ws.result && !ws.startPending && !ws.loading && (
        <p className="rounded-lg border border-ocean-mid/40 bg-ocean-surface px-4 py-3 text-sm text-ocean-sand">
          Run finished but no strategy groups were returned. Confirm the strategy is{" "}
          <strong className="text-ocean-foam">active</strong> and was included in the evaluate request.
        </p>
      )}
    </div>
  );
}
