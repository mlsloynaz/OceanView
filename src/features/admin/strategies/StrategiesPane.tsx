import { Link } from "react-router-dom";
import { AdminExpandedPane } from "@/features/admin/components/AdminExpandedPane";
import { cn } from "@/shared/lib/cn";
import { DynamicStrategyCatalog } from "@/features/premarket/components/DynamicStrategyCatalog";
import { StrategyBuilderModal } from "@/features/premarket/components/StrategyBuilderModal";
import { useStrategiesPane } from "./hooks/useStrategiesPane";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export function StrategiesPane() {
  const ws = useStrategiesPane();
  const standardActiveCount = ws.standardStrategies.filter((s) => s.active).length;
  const dynamicActiveCount = ws.dynamicStrategies.filter((s) => s.active).length;
  const summary = `${standardActiveCount} standard active (Market) · ${dynamicActiveCount} dynamic active (Premarket)`;

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
            <button
              type="button"
              className={cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-105")}
              disabled={ws.saving}
              onClick={ws.openBuilderForNew}
            >
              New
            </button>
          }
        >
          {ws.error && !ws.builderOpen && (
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
            screens evaluate on Premarket. Promote, demote, activate, edit, and delete from this list.
          </p>

          <DynamicStrategyCatalog
            embedded
            strategies={ws.strategies}
            saving={ws.saving}
            onEdit={ws.loadStrategyForEdit}
            onNew={ws.openBuilderForNew}
            onToggleActive={(s) => void ws.toggleStrategyActive(s)}
            onDelete={(s) => void ws.deleteStrategy(s)}
            onPromote={(s) => void ws.promoteStrategy(s)}
            onDemote={(s) => void ws.demoteStrategy(s)}
          />
        </AdminExpandedPane>
      )}

      {ws.builderOpen && (
        <StrategyBuilderModal
          rules={ws.rules}
          selectedRuleKeys={ws.selectedRuleKeys}
          rulePathVariants={ws.rulePathVariants}
          ruleTypes={ws.ruleTypes}
          name={ws.builderName}
          shortName={ws.builderShortName}
          description={ws.builderDescription}
          direction={ws.builderDirection}
          editingStrategyId={ws.editingStrategyId}
          saving={ws.saving}
          startPending={ws.previewPending}
          error={ws.error}
          onNameChange={ws.setBuilderName}
          onShortNameChange={ws.setBuilderShortName}
          onDescriptionChange={ws.setBuilderDescription}
          onDirectionChange={ws.setBuilderDirection}
          onPathVariantChange={ws.setRulePathVariant}
          onRuleTypeChange={ws.setRuleType}
          onAddRule={ws.addRuleToBuilder}
          onRemoveRule={ws.removeRuleFromBuilder}
          onMoveRule={ws.moveRuleInBuilder}
          onSave={() => void ws.saveBuilder()}
          onPreview={() => void ws.previewBuilder()}
          onDelete={
            ws.editingStrategyId &&
            ws.strategies.some(
              (row) => row.id === ws.editingStrategyId && ws.resolveStrategyTier(row) === "dynamic",
            )
              ? () => void ws.deleteEditingStrategy()
              : undefined
          }
          onClose={ws.closeBuilder}
        />
      )}
    </>
  );
}
