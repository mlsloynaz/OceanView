import { PremarketBanner } from "./components/PremarketBanner";
import { PremarketDiagnostics } from "./components/PremarketDiagnostics";
import { PremarketEmptyState } from "./components/PremarketEmptyState";
import { PremarketStrategySection } from "./components/PremarketStrategySection";
import { PremarketToolbar } from "./components/PremarketToolbar";
import { usePremarketWorkspace } from "./hooks/usePremarketWorkspace";

export function PremarketPage() {
  const {
    result,
    loading,
    startPending,
    stopPending,
    error,
    notice,
    threshold,
    startEvaluate,
    stopEvaluate,
    refreshResult,
  } = usePremarketWorkspace();

  const strategies = result?.strategies ?? [];
  const hasResults = strategies.length > 0;
  const showEmpty = !loading && !startPending && !hasResults && !error;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ocean-foam">Premarket</h1>
        <p className="mt-2 text-ocean-sand">
          Pre-open scan at 9:25 AM ET — extended-hours bars in memory only; Admin candles are not
          updated.
        </p>
      </div>

      <PremarketBanner />

      <PremarketToolbar
        result={result}
        startPending={startPending}
        stopPending={stopPending}
        loading={loading}
        threshold={threshold}
        onStart={() => void startEvaluate()}
        onStop={() => void stopEvaluate()}
        onRefresh={() => void refreshResult()}
      />

      {notice && (
        <p className="text-sm text-ocean-teal-dim dark:text-ocean-teal" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="text-sm text-ocean-danger" role="alert">
          {error}
        </p>
      )}

      {loading && !result && !startPending && (
        <p className="text-sm text-ocean-sand">Loading last premarket result…</p>
      )}

      {startPending && (
        <p className="text-sm text-ocean-sand">
          Running premarket evaluate for all active tickers and strategies. This may take a minute…
        </p>
      )}

      {hasResults && (
        <div className="space-y-4">
          {result?.summary && (
            <p className="text-xs text-ocean-sand">
              {result.summary.symbolsAboveThreshold ?? 0} hit(s) across{" "}
              {result.summary.strategyCount ?? strategies.length} strateg
              {(result.summary.strategyCount ?? strategies.length) === 1 ? "y" : "ies"} ·{" "}
              {result.summary.symbolsTotal ?? "—"} symbols evaluated
            </p>
          )}
          {strategies.map((group) => (
            <PremarketStrategySection
              key={group.strategyId}
              group={group}
              threshold={threshold}
            />
          ))}
        </div>
      )}

      {showEmpty && <PremarketEmptyState threshold={threshold} />}

      {!hasResults && result && !startPending && !loading && (
        <p className="rounded-lg border border-ocean-mid/40 bg-ocean-surface px-4 py-3 text-sm text-ocean-sand">
          Run complete — no tickers met ≥ {threshold}% for any active strategy.
        </p>
      )}

      {result?.symbolOutcomes && result.symbolOutcomes.length > 0 && (
        <PremarketDiagnostics outcomes={result.symbolOutcomes} />
      )}
    </div>
  );
}
