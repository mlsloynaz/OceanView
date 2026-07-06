import { Link } from "react-router-dom";
import { AdminExpandedPane } from "@/features/admin/components/AdminExpandedPane";
import { cn } from "@/shared/lib/cn";
import { DynamicStrategyCatalog } from "@/features/premarket/components/DynamicStrategyCatalog";
import { StrategyBuilderModal } from "@/features/premarket/components/StrategyBuilderModal";
import { StandardStrategyCatalog } from "./components/StandardStrategyCatalog";
import { useStrategiesPane } from "./hooks/useStrategiesPane";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export function StrategiesPane() {
  const ws = useStrategiesPane();
  const standardActiveCount = ws.standardStrategies.filter((s) => s.active !== false).length;
  const dynamicActiveCount = ws.strategies.filter((s) => s.active).length;
  const summary = `${standardActiveCount} standard (Market) · ${dynamicActiveCount} dynamic (Premarket)`;

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
          <p className="text-sm text-ocean-sand">Loading strategy catalogs…</p>
        </AdminExpandedPane>
      ) : (
        <AdminExpandedPane
          id="admin-strategies-pane"
          title="Strategies"
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
            </p>
          )}

          <StandardStrategyCatalog
            strategies={ws.standardStrategies}
            saving={ws.saving}
            onToggleActive={(s) => void ws.toggleStandardStrategyActive(s)}
          />

          <div
            className="my-6 border-t border-ocean-mid/50"
            role="separator"
            aria-label="Dynamic strategies"
          />

          <div className="mb-3">
            <h3 className="text-sm font-semibold text-ocean-foam">Dynamic strategies</h3>
            <p className="mt-0.5 text-[11px] text-ocean-sand">
              User-built rule screens in Dynamo —{" "}
              <strong className="font-medium text-ocean-foam">Premarket evaluate only</strong>.
              Separate from standard playbooks above. Promotion to standard catalog may come later;
              not available yet.
            </p>
          </div>

          <DynamicStrategyCatalog
            embedded
            strategies={ws.strategies}
            saving={ws.saving}
            onEdit={ws.loadStrategyForEdit}
            onNew={ws.openBuilderForNew}
            onToggleActive={(s) => void ws.toggleStrategyActive(s)}
          />
        </AdminExpandedPane>
      )}

      {ws.builderOpen && (
        <StrategyBuilderModal
          rules={ws.rules}
          selectedRuleKeys={ws.selectedRuleKeys}
          rulePathVariants={ws.rulePathVariants}
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
          onAddRule={ws.addRuleToBuilder}
          onRemoveRule={ws.removeRuleFromBuilder}
          onMoveRule={ws.moveRuleInBuilder}
          onSave={() => void ws.saveBuilder()}
          onPreview={() => void ws.previewBuilder()}
          onClose={ws.closeBuilder}
        />
      )}
    </>
  );
}
