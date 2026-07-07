import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useStrategiesPane } from "@/features/admin/strategies/hooks/useStrategiesPane";
import { cn } from "@/shared/lib/cn";
import { DynamicStrategyBuilder } from "./components/DynamicStrategyBuilder";
import {
  DEFAULT_STRATEGY_BUILDER_RETURN,
  STRATEGY_BUILDER_NEW_PATH,
  type StrategyBuilderLocationState,
} from "./lib/strategy-builder-routes";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

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
    const saved = await ws.saveBuilder();
    if (saved) navigate(returnTo);
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
            Each rule is a row. Add the same rule twice to build CALL and PUT paths with different
            trend or operation.{" "}
            <Link to="/premarket" className="text-ocean-teal hover:underline">
              Premarket
            </Link>
            {" · "}
            <Link to="/admin#admin-strategies-pane" className="text-ocean-teal hover:underline">
              Strategy catalog
            </Link>
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
        <div className="overflow-hidden rounded-xl border border-ocean-mid/40 bg-ocean-surface shadow-sm">
          <DynamicStrategyBuilder
            layout="page"
            rules={ws.rules}
            builderRows={ws.builderRows}
            name={ws.builderName}
            shortName={ws.builderShortName}
            description={ws.builderDescription}
            editingStrategyId={ws.editingStrategyId}
            saving={ws.saving}
            startPending={ws.previewPending}
            error={ws.error}
            onNameChange={ws.setBuilderName}
            onShortNameChange={ws.setBuilderShortName}
            onDescriptionChange={ws.setBuilderDescription}
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
