import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useStrategiesPane } from "@/features/admin/strategies/hooks/useStrategiesPane";
import { cn } from "@/shared/lib/cn";
import { DynamicStrategyBuilder } from "./components/DynamicStrategyBuilder";
import {
  DEFAULT_STRATEGY_BUILDER_RETURN,
  STRATEGY_BUILDER_NEW_PATH,
  strategyBuilderEditPath,
  type StrategyBuilderLocationState,
} from "./lib/strategy-builder-routes";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

function BuilderSaveOverlay() {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-ocean-deep/55 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3 rounded-xl border border-ocean-mid/40 bg-ocean-surface px-8 py-6 shadow-lg">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-ocean-teal/30 border-t-ocean-teal"
          aria-hidden
        />
        <p className="text-sm font-medium text-ocean-foam">Guardando…</p>
      </div>
    </div>
  );
}

export function StrategyBuilderPage() {
  const { strategyId } = useParams<{ strategyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state ?? {}) as StrategyBuilderLocationState;
  const returnTo = locationState.returnTo ?? DEFAULT_STRATEGY_BUILDER_RETURN;
  const isNew = location.pathname === STRATEGY_BUILDER_NEW_PATH;

  const ws = useStrategiesPane();
  const hydratedKeyRef = useRef<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    hydratedKeyRef.current = null;
    setHydrated(false);
  }, [location.pathname]);

  useEffect(() => {
    if (ws.loading) return;

    const hydrationKey = isNew ? "new" : strategyId ?? "";
    if (!hydrationKey || hydratedKeyRef.current === hydrationKey) return;

    if (isNew) {
      ws.resetBuilder();
      hydratedKeyRef.current = hydrationKey;
      setHydrated(true);
      return;
    }

    const strategy = ws.strategies.find((row) => row.id === strategyId);
    if (!strategy) {
      navigate(returnTo, { replace: true });
      return;
    }

    ws.hydrateBuilderFromStrategy(strategy);
    hydratedKeyRef.current = hydrationKey;
    setHydrated(true);
  }, [
    isNew,
    navigate,
    returnTo,
    strategyId,
    ws.loading,
    ws.strategies,
    ws.resetBuilder,
    ws.hydrateBuilderFromStrategy,
  ]);

  const handleCancel = () => {
    ws.resetBuilder();
    navigate(returnTo);
  };

  const handleSave = async () => {
    const saved = await ws.saveBuilder({ stayOnPage: true });
    if (!saved) return;
    if (isNew) {
      navigate(strategyBuilderEditPath(saved.id), { replace: true, state: locationState });
    }
  };

  const handleDelete = async () => {
    const deleted = await ws.deleteEditingStrategy();
    if (deleted) navigate(returnTo);
  };

  const editingStrategy = ws.editingStrategyId
    ? ws.strategies.find((row) => row.id === ws.editingStrategyId)
    : null;
  const canDelete =
    editingStrategy != null && ws.resolveStrategyTier(editingStrategy) === "dynamic";

  const pageTitle = isNew ? "New strategy" : "Edit strategy";
  const ready = hydrated && !ws.loading;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="space-y-3">
        <button
          type="button"
          className={cn(BTN, "text-ocean-sand hover:text-ocean-foam")}
          onClick={handleCancel}
        >
          ← Back
        </button>
        <div>
          <h1 className="font-display text-3xl font-semibold text-ocean-foam">{pageTitle}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ocean-sand">
            Build a screen by adding rules, set CALL/PUT paths per row, then preview or save.
          </p>
        </div>
        {ws.notice && (
          <p className="text-sm text-ocean-teal-dim dark:text-ocean-teal" role="status">
            {ws.notice}
          </p>
        )}
      </header>

      {!ready ? (
        <p className="text-sm text-ocean-sand">Loading strategy catalog…</p>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-ocean-mid/40 bg-ocean-surface shadow-sm">
          {ws.saving ? <BuilderSaveOverlay /> : null}
          <DynamicStrategyBuilder
            layout="page"
            rules={ws.rules}
            builderRows={ws.builderRows}
            name={ws.builderName}
            strategyId={ws.builderStrategyId}
            editingStrategyId={ws.editingStrategyId}
            templateStrategies={ws.strategies}
            saving={ws.saving}
            startPending={ws.previewPending}
            error={ws.error}
            onNameChange={ws.setBuilderName}
            onStrategyIdChange={ws.setBuilderStrategyId}
            onCloneFrom={isNew ? ws.cloneBuilderFromStrategy : undefined}
            onTrendChange={ws.setRuleTrend}
            onOperationChange={ws.setRuleOperation}
            onRuleTypeChange={ws.setRuleType}
            onAddRule={ws.addRuleToBuilder}
            onRemoveRule={ws.removeRuleFromBuilder}
            onMoveRule={ws.moveRuleInBuilder}
            onCancel={handleCancel}
            onSave={() => void handleSave()}
            onPreview={() => void ws.previewBuilder()}
            onDelete={canDelete ? () => void handleDelete() : undefined}
          />
        </div>
      )}
    </div>
  );
}
