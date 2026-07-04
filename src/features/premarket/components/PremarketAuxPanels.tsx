import { useState } from "react";
import type { useStrategiesPane } from "@/features/admin/strategies/hooks/useStrategiesPane";
import { AdminExpandedPane } from "@/features/admin/components/AdminExpandedPane";
import { AdminPaneThumbnail } from "@/features/admin/components/AdminPaneThumbnail";
import { cn } from "@/shared/lib/cn";
import type { usePremarketWorkspace } from "../hooks/usePremarketWorkspace";
import { DynamicStrategyCatalog } from "./DynamicStrategyCatalog";
import { PremarketDiagnostics } from "./PremarketDiagnostics";
import { StrategyBuilderModal } from "./StrategyBuilderModal";

type AuxPaneId = "strategies" | "diagnostics";

type BuilderState = ReturnType<typeof useStrategiesPane>;
type WorkspaceState = ReturnType<typeof usePremarketWorkspace>;

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  ws: WorkspaceState;
  builder: BuilderState;
  onStrategyMutated: () => void;
};

function IconStrategy() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M11.3 1.046a1 1 0 011.4 0l2.25 2.25a1 1 0 01.263.868v5.677a2.75 2.75 0 01-1.013 2.122l-4.25 3.404a1 1 0 01-1.25 0l-4.25-3.404A2.75 2.75 0 013.787 9.841V4.164a1 1 0 01.263-.868L6.3 1.046a1 1 0 011.4 0L10 3.347l3.3-2.301zM7 4.662L4.596 6.336v3.505c0 .564.247 1.1.676 1.464L10 14.227l4.728-3.922a1.75 1.75 0 00.676-1.464V6.336L12.3 4.662 10 6.265 7 4.662z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconDiagnostics() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-1.25 3.5a.75.75 0 11-1.404-.514l.803-2.248A1.75 1.75 0 009.253 9H9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function PremarketAuxPanels({ ws, builder, onStrategyMutated }: Props) {
  const [activePane, setActivePane] = useState<AuxPaneId | null>(null);

  const outcomes = ws.result?.symbolOutcomes ?? [];
  const issueCount = outcomes.filter((row) => !row.ready || row.error).length;
  const activeStrategyCount = builder.strategies.filter((s) => s.active).length;

  const selectPane = (id: AuxPaneId) => {
    setActivePane((current) => (current === id ? null : id));
  };

  const strategySummary = builder.loading
    ? "Loading catalog…"
    : `${builder.strategies.length} saved · ${activeStrategyCount} active`;

  const diagnosticsSummary =
    outcomes.length === 0
      ? "Available after an evaluate run"
      : issueCount > 0
        ? `${issueCount} with issues · ${outcomes.length} total`
        : `${outcomes.length} symbols evaluated`;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <AdminPaneThumbnail
          title="Strategy builder"
          description={strategySummary}
          icon={<IconStrategy />}
          active={activePane === "strategies"}
          onClick={() => selectPane("strategies")}
        />
        <AdminPaneThumbnail
          title="Symbol diagnostics"
          description={diagnosticsSummary}
          icon={<IconDiagnostics />}
          active={activePane === "diagnostics"}
          onClick={() => selectPane("diagnostics")}
        />
      </div>

      {activePane === "strategies" && (
        <AdminExpandedPane
          id="premarket-strategy-builder-pane"
          title="Strategy builder"
          subtitle={strategySummary}
          headerExtra={
            <button
              type="button"
              className={cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-105")}
              disabled={builder.saving || builder.loading}
              onClick={builder.openBuilderForNew}
            >
              New
            </button>
          }
        >
          {builder.error && !builder.builderOpen && (
            <p className="mb-3 text-sm text-ocean-danger" role="alert">
              {builder.error}
            </p>
          )}
          {builder.loading ? (
            <p className="text-sm text-ocean-sand">Loading strategy catalog…</p>
          ) : (
            <DynamicStrategyCatalog
              embedded
              strategies={builder.strategies}
              saving={builder.saving}
              onEdit={builder.loadStrategyForEdit}
              onNew={builder.openBuilderForNew}
              onToggleActive={async (strategy) => {
                await builder.toggleStrategyActive(strategy);
                onStrategyMutated();
              }}
            />
          )}
        </AdminExpandedPane>
      )}

      {activePane === "diagnostics" && (
        <AdminExpandedPane
          id="premarket-diagnostics-pane"
          title="Symbol diagnostics"
          subtitle={diagnosticsSummary}
        >
          {outcomes.length === 0 ? (
            <p className="text-sm text-ocean-sand">
              No symbol outcomes yet. Run <strong className="text-ocean-foam">Evaluate strategies</strong>{" "}
              to see per-symbol readiness and errors.
            </p>
          ) : (
            <PremarketDiagnostics embedded outcomes={outcomes} />
          )}
        </AdminExpandedPane>
      )}

      {builder.builderOpen && (
        <StrategyBuilderModal
          rules={builder.rules}
          selectedRuleKeys={builder.selectedRuleKeys}
          name={builder.builderName}
          shortName={builder.builderShortName}
          description={builder.builderDescription}
          direction={builder.builderDirection}
          editingStrategyId={builder.editingStrategyId}
          saving={builder.saving}
          startPending={builder.previewPending}
          error={builder.error}
          onNameChange={builder.setBuilderName}
          onShortNameChange={builder.setBuilderShortName}
          onDescriptionChange={builder.setBuilderDescription}
          onDirectionChange={builder.setBuilderDirection}
          onAddRule={builder.addRuleToBuilder}
          onRemoveRule={builder.removeRuleFromBuilder}
          onMoveRule={builder.moveRuleInBuilder}
          onSave={async () => {
            const saved = await builder.saveBuilder();
            if (saved) onStrategyMutated();
          }}
          onPreview={() => void builder.previewBuilder()}
          onClose={builder.closeBuilder}
        />
      )}
    </>
  );
}
