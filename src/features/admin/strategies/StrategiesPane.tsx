import { Link, useNavigate } from "react-router-dom";
import { AdminExpandedPane } from "@/features/admin/components/AdminExpandedPane";
import { cn } from "@/shared/lib/cn";
import { DynamicStrategyCatalog } from "@/features/premarket/components/DynamicStrategyCatalog";
import type { DynamicStrategy } from "@/features/premarket/api/dynamic-strategy-client";
import {
  DEFAULT_STRATEGY_BUILDER_RETURN,
  STRATEGY_BUILDER_NEW_PATH,
  strategyBuilderEditPath,
  type StrategyBuilderLocationState,
} from "@/features/premarket/lib/strategy-builder-routes";
import { useStrategiesPane } from "./hooks/useStrategiesPane";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const ADMIN_BUILDER_STATE: StrategyBuilderLocationState = {
  returnTo: DEFAULT_STRATEGY_BUILDER_RETURN,
};

export function StrategiesPane() {
  const navigate = useNavigate();
  const ws = useStrategiesPane();
  const standardActiveCount = ws.standardStrategies.filter((s) => s.active).length;
  const dynamicActiveCount = ws.dynamicStrategies.filter((s) => s.active).length;
  const summary = `${standardActiveCount} standard active (Market) · ${dynamicActiveCount} dynamic active (Premarket)`;

  const openNewStrategy = () => {
    navigate(STRATEGY_BUILDER_NEW_PATH, { state: ADMIN_BUILDER_STATE });
  };

  const openEditStrategy = (strategy: DynamicStrategy) => {
    navigate(strategyBuilderEditPath(strategy.id), { state: ADMIN_BUILDER_STATE });
  };

  return (
    <>
      {ws.useMock ? (
        <AdminExpandedPane
          id="admin-strategies-pane"
          title="Strategies"
          subtitle="Mock mode — strategy builder unavailable"
        >
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            Mock mode — use <code className="text-[11px]">npm run dev:local</code> for the strategy
            builder and live evaluate.
          </p>
        </AdminExpandedPane>
      ) : ws.loading ? (
        <AdminExpandedPane id="admin-strategies-pane" title="Strategies" subtitle="Loading catalog…">
          <p className="text-sm text-ocean-sand">Loading strategy catalog…</p>
        </AdminExpandedPane>
      ) : (
        <AdminExpandedPane
          id="admin-strategies-pane"
          title="Strategy builder"
          subtitle={summary}
          headerExtra={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={cn(
                  BTN,
                  ws.hasUnsavedChanges
                    ? "bg-amber-500 text-ocean-deep hover:brightness-105"
                    : "bg-ocean-mid/50 text-ocean-sand",
                )}
                disabled={ws.saving || !ws.hasUnsavedChanges}
                onClick={() => void ws.saveAllStrategies()}
              >
                {ws.saving ? "Saving…" : ws.hasUnsavedChanges ? `Save all (${ws.dirtyCount})` : "Save all"}
              </button>
              <button
                type="button"
                className={cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-105")}
                disabled={ws.saving}
                onClick={openNewStrategy}
              >
                New
              </button>
            </div>
          }
        >
          {ws.error && (
            <p className="mb-3 text-sm text-ocean-danger" role="alert">
              {ws.error}
            </p>
          )}
          {ws.notice && (
            <p className="mb-3 text-sm text-ocean-teal-dim dark:text-ocean-teal" role="status">
              {ws.notice}{" "}
              <Link to="/premarket" className="underline hover:text-ocean-foam">
                Open Premarket
              </Link>
              {" · "}
              <Link to="/market" className="underline hover:text-ocean-foam">
                Open Market
              </Link>
            </p>
          )}

          <p className="mb-4 text-[11px] text-ocean-sand">
            Unified catalog in Dynamo. <strong className="font-medium text-ocean-foam">Standard</strong>{" "}
            strategies evaluate on Market; <strong className="font-medium text-ocean-foam">dynamic</strong>{" "}
            screens evaluate on Premarket. Activate, edit rules, then click{" "}
            <strong className="font-medium text-ocean-foam">Save all</strong> once to persist.
          </p>

          <DynamicStrategyCatalog
            embedded
            strategies={ws.strategies}
            saving={ws.saving}
            dirtyIds={ws.dirtyIds}
            hasUnsavedChanges={ws.hasUnsavedChanges}
            onEdit={openEditStrategy}
            onNew={openNewStrategy}
            onToggleActive={(s) => ws.toggleStrategyActive(s)}
            onDelete={(s) => void ws.deleteStrategy(s)}
            onPromote={(s) => void ws.promoteStrategy(s)}
            onDemote={(s) => void ws.demoteStrategy(s)}
            onSaveAll={() => void ws.saveAllStrategies()}
          />
        </AdminExpandedPane>
      )}
    </>
  );
}
