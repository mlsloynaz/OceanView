import { MarketDetailModal } from "@/features/market/components/MarketDetailModal";
import { DynamicStrategyBuilder } from "./DynamicStrategyBuilder";
import type { ComponentProps } from "react";

type BuilderProps = ComponentProps<typeof DynamicStrategyBuilder>;

type Props = Omit<BuilderProps, "onCancel"> & {
  onClose: () => void;
  onDelete?: () => void;
};

export function StrategyBuilderModal({ onClose, onDelete, editingStrategyId, ...rest }: Props) {
  const isEditing = editingStrategyId != null;

  return (
    <MarketDetailModal
      open
      onClose={onClose}
      className="max-w-5xl"
      title={isEditing ? "Edit strategy" : "New strategy"}
      subtitle="Add rules from the library, name your screen, then save to Dynamo or preview on active tickers."
    >
      <DynamicStrategyBuilder
        editingStrategyId={editingStrategyId}
        {...rest}
        onCancel={onClose}
        onDelete={onDelete}
      />
    </MarketDetailModal>
  );
}
