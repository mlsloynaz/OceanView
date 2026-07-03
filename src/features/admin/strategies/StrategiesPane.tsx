import { Link } from "react-router-dom";
import { DynamicStrategyCatalog } from "@/features/premarket/components/DynamicStrategyCatalog";
import { StrategyBuilderModal } from "@/features/premarket/components/StrategyBuilderModal";
import { useStrategiesPane } from "./hooks/useStrategiesPane";

export function StrategiesPane() {
  const ws = useStrategiesPane();

  return (
    <section className="space-y-3">
      {ws.useMock ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          Mock mode — use <code className="text-[11px]">npm run dev:local</code> for the strategy
          builder and live evaluate.
        </p>
      ) : ws.loading ? (
        <p className="text-sm text-ocean-sand">Loading dynamic strategy catalog…</p>
      ) : (
        <>
          {ws.error && !ws.builderOpen && (
            <p className="text-sm text-ocean-danger" role="alert">
              {ws.error}
            </p>
          )}
          {ws.notice && (
            <p className="text-sm text-ocean-teal-dim dark:text-ocean-teal" role="status">
              {ws.notice}
              {" "}
              <Link to="/premarket" className="underline hover:text-ocean-foam">
                Open Premarket
              </Link>
            </p>
          )}

          <DynamicStrategyCatalog
            strategies={ws.strategies}
            saving={ws.saving}
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
              saving={ws.saving}
              startPending={ws.previewPending}
              error={ws.error}
              onNameChange={ws.setBuilderName}
              onShortNameChange={ws.setBuilderShortName}
              onDescriptionChange={ws.setBuilderDescription}
              onDirectionChange={ws.setBuilderDirection}
              onAddRule={ws.addRuleToBuilder}
              onRemoveRule={ws.removeRuleFromBuilder}
              onMoveRule={ws.moveRuleInBuilder}
              onSave={() => void ws.saveBuilder()}
              onPreview={() => void ws.previewBuilder()}
              onClose={ws.closeBuilder}
            />
          )}
        </>
      )}
    </section>
  );
}
