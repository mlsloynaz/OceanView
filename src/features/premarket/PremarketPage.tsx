import { Link } from "react-router-dom";
import { useStrategiesPane } from "@/features/admin/strategies/hooks/useStrategiesPane";
import { useAuth } from "@/shared/auth/AuthProvider";
import { PremarketAuxPanels } from "./components/PremarketAuxPanels";
import { PremarketBanner } from "./components/PremarketBanner";
import { PremarketEmptyState } from "./components/PremarketEmptyState";
import { PremarketStrategySection } from "./components/PremarketStrategySection";
import { PremarketToolbar } from "./components/PremarketToolbar";
import { usePremarketWorkspace } from "./hooks/usePremarketWorkspace";
import { isPremarketEvaluateTerminal } from "./display";

export function PremarketPage() {
  const { isAdmin } = useAuth();
  const ws = usePremarketWorkspace();
  const builder = useStrategiesPane({ enabled: isAdmin });

  const resultStrategies = ws.result?.strategies ?? [];
  const hasResults = resultStrategies.length > 0;
  const hasCompletedRun =
    Boolean(ws.result?.runId) &&
    (Boolean(ws.result?.evaluatedAt) || isPremarketEvaluateTerminal(ws.result?.status));
  const showEmpty =
    !ws.loading && !ws.startPending && !hasResults && !hasCompletedRun && !ws.error && !ws.useMock;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ocean-foam">Premarket</h1>
        <p className="mt-2 text-ocean-sand">
          Evaluate saved strategies against extended-hours bars. Rules are shared with{" "}
          <Link to="/market" className="text-ocean-teal hover:underline">
            Market
          </Link>{" "}
          (regular session bars). Manage screens in Strategy builder / Admin.
          {isAdmin ? (
            <>
              {" "}
              Open{" "}
              <strong className="font-medium text-ocean-foam">Strategy builder</strong> below, or
              manage screens in{" "}
              <Link to="/admin" className="text-ocean-teal hover:underline">
                Admin
              </Link>
              .
            </>
          ) : null}{" "}
          Extended-hours bars stay in memory only.
        </p>
      </div>

      {ws.catalogError && (
        <p className="text-sm text-ocean-danger" role="alert">
          {ws.catalogError}
        </p>
      )}

      {!ws.catalogLoading && ws.activeStrategyCount === 0 && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          {isAdmin ? (
            <>
              No active dynamic strategies — save and activate a screen in{" "}
              <strong className="font-medium">Strategy builder</strong> below, or create one in{" "}
              <Link to="/admin" className="font-medium underline hover:text-ocean-foam">
                Admin → Strategies
              </Link>
              .
            </>
          ) : (
            <>No active dynamic strategies yet. Ask an admin to activate a saved screen.</>
          )}
        </p>
      )}

      <PremarketBanner />

      <PremarketAuxPanels
        ws={ws}
        isAdmin={isAdmin}
        builder={builder}
        onStrategyMutated={() => void ws.reloadCatalog()}
      />

      <PremarketToolbar
        isAdmin={isAdmin}
        result={ws.result}
        activeStrategyCount={ws.activeStrategyCount}
        evaluateGroupLabel={ws.evaluateGroupLabel}
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
        assessmentNotice={ws.assessmentNotice}
        coverageMin={ws.coverageBounds?.min}
        coverageMax={ws.coverageBounds?.max}
        onAssessmentModeChange={ws.setAssessmentMode}
        onAssessmentTimeChange={ws.setAssessmentFromLocal}
        onStart={() => void ws.startEvaluate()}
        onStop={() => void ws.stopEvaluate()}
        onRefresh={() => void ws.refreshResult()}
      />

      {(ws.notice || (isAdmin && builder.notice)) && (
        <p className="text-sm text-ocean-teal-dim dark:text-ocean-teal" role="status">
          {(isAdmin && builder.notice) ?? ws.notice}
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
          Evaluating against {ws.activeStrategyCount} dynamic strateg
          {ws.activeStrategyCount === 1 ? "y" : "ies"} ({ws.evaluateGroupLabel})…
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
        <PremarketEmptyState
          isAdmin={isAdmin}
          hasActiveStrategies={ws.activeStrategyCount > 0}
        />
      )}

      {hasResults && ws.threshold > 0 && (ws.result?.summary?.symbolsAboveThreshold ?? 0) === 0 && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          No tickers reached ≥ {ws.threshold}% quality — click a ticker chip below to see per-rule
          evidence. Volatility often reads <strong>not met</strong> at the open until BB width and
          ATR expand (need index ≥ 1.35 and ATR ratio ≥ 1.20 on 15m).
        </p>
      )}

      {!hasResults && hasCompletedRun && !ws.startPending && !ws.loading && (
        <div className="space-y-3 rounded-lg border border-ocean-mid/40 bg-ocean-surface px-4 py-3 text-sm text-ocean-sand">
          <p>
            Evaluate finished ({ws.result?.summary?.symbolsTotal ?? 0} symbols) but no strategy
            groups were built for the response. Open{" "}
            <strong className="text-ocean-foam">Symbol diagnostics</strong> above to see per-symbol
            readiness.
          </p>
          {(ws.result?.symbolOutcomes?.length ?? 0) > 0 && (
            <p className="text-xs">
              {(ws.result?.symbolOutcomes ?? []).filter((row) => row.ready).length} ready ·{" "}
              {(ws.result?.symbolOutcomes ?? []).filter((row) => row.error).length} errors
            </p>
          )}
        </div>
      )}
    </div>
  );
}
