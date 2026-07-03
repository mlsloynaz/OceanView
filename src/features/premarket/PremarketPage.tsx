import { DynamicStrategyCatalog } from "./components/DynamicStrategyCatalog";
import { StrategyBuilderModal } from "./components/StrategyBuilderModal";
import { PremarketBanner } from "./components/PremarketBanner";
import { PremarketDiagnostics } from "./components/PremarketDiagnostics";
import { PremarketEmptyState } from "./components/PremarketEmptyState";
import { PremarketStrategySection } from "./components/PremarketStrategySection";
import { PremarketToolbar } from "./components/PremarketToolbar";
import { usePremarketWorkspace } from "./hooks/usePremarketWorkspace";

export function PremarketPage() {
  const ws = usePremarketWorkspace();

  const resultStrategies = ws.result?.strategies ?? [];
  const hasResults = resultStrategies.length > 0;
  const showEmpty =
    !ws.loading && !ws.startPending && !hasResults && !ws.error && !ws.useMock;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ocean-foam">Premarket</h1>
        <p className="mt-2 text-ocean-sand">
          Manage dynamic strategies in Dynamo and evaluate all active tickers. Extended-hours bars
          stay in memory only.
        </p>
      </div>

      {ws.useMock ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          Mock mode — use <code className="text-[11px]">npm run dev:local</code> for the strategy
          builder and live evaluate.
        </p>
      ) : ws.catalogLoading ? (
        <p className="text-sm text-ocean-sand">Loading dynamic strategy catalog…</p>
      ) : (
        <>
          {ws.catalogError && !ws.builderOpen && (
            <p className="text-sm text-ocean-danger" role="alert">
              {ws.catalogError}
            </p>
          )}

          <DynamicStrategyCatalog
            strategies={ws.strategies}
            saving={ws.catalogSaving}
            onEdit={ws.loadStrategyForEdit}
            onNew={ws.openBuilderForNew}
            onToggleActive={(s) => void ws.toggleStrategyActive(s)}
          />

          {ws.builderOpen && (
            <StrategyBuilderModal
              rules={ws.rules}
              selectedRuleKeys={ws.selectedRuleKeys}
              name={ws.builderName}
              shortName={ws.builderShortName}
              description={ws.builderDescription}
              direction={ws.builderDirection}
              editingStrategyId={ws.editingStrategyId}
              saving={ws.catalogSaving}
              startPending={ws.startPending}
              error={ws.catalogError}
              onNameChange={ws.setBuilderName}
              onShortNameChange={ws.setBuilderShortName}
              onDescriptionChange={ws.setBuilderDescription}
              onDirectionChange={ws.setBuilderDirection}
              onAddRule={ws.addRuleToBuilder}
              onRemoveRule={ws.removeRuleFromBuilder}
              onMoveRule={ws.moveRuleInBuilder}
              onSave={() => void ws.saveBuilder()}
              onPreview={() => void ws.startEvaluate("rules")}
              onClose={ws.closeBuilder}
            />
          )}
        </>
      )}

      <PremarketBanner />

      <PremarketToolbar
        result={ws.result}
        activeStrategyCount={ws.activeStrategies.length}
        evaluateRunning={ws.evaluateRunning}
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
        onStart={() => void ws.startEvaluate("strategies")}
        onStop={() => void ws.stopEvaluate()}
        onRefresh={() => void ws.refreshResult()}
      />

      {ws.notice && (
        <p className="text-sm text-ocean-teal-dim dark:text-ocean-teal" role="status">
          {ws.notice}
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
          No tickers reached ≥ {ws.threshold}% quality — expand tickers below to see per-rule
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

      {ws.result?.symbolOutcomes && ws.result.symbolOutcomes.length > 0 && (
        <PremarketDiagnostics outcomes={ws.result.symbolOutcomes} />
      )}
    </div>
  );
}
