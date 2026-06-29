import { useState } from "react";
import { CollapsibleSection } from "@/shared/components/CollapsibleSection";
import type { PremarketStrategyGroup } from "../types";
import { PremarketTickerRow } from "./PremarketTickerRow";

type Props = {
  group: PremarketStrategyGroup;
  threshold: number;
  defaultOpen?: boolean;
};

export function PremarketStrategySection({ group, threshold, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const title = group.shortName || group.name || group.strategyId;
  const count = group.tickers.length;

  return (
    <CollapsibleSection
      id={`premarket-strategy-${group.strategyId}`}
      title={title}
      subtitle={`${group.strategyId} · ${count} ticker${count === 1 ? "" : "s"} ≥ ${threshold}%`}
      open={open}
      onOpenChange={setOpen}
      className="min-w-0"
    >
      <ul className="flex flex-wrap gap-2">
        {group.tickers.map((ticker) => (
          <PremarketTickerRow key={ticker.symbol} ticker={ticker} threshold={threshold} />
        ))}
      </ul>
    </CollapsibleSection>
  );
}
