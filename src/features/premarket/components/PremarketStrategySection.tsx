import { useState } from "react";
import { CollapsibleSection } from "@/shared/components/CollapsibleSection";
import type { PremarketStrategyGroup, PremarketTickerHit } from "../types";
import { strategyGroupSubtitle } from "../display";
import { PremarketTickerDetailModal } from "./PremarketTickerDetailModal";
import { PremarketTickerRow } from "./PremarketTickerRow";

type Props = {
  group: PremarketStrategyGroup;
  threshold: number;
  defaultOpen?: boolean;
};

export function PremarketStrategySection({ group, threshold, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [detailTicker, setDetailTicker] = useState<PremarketTickerHit | null>(null);
  const title = group.shortName || group.name || group.strategyId;
  const count = group.tickers.length;

  return (
    <>
      <CollapsibleSection
        id={`premarket-strategy-${group.strategyId}`}
        title={title}
        subtitle={strategyGroupSubtitle(group.strategyId, count, threshold)}
        open={open}
        onOpenChange={setOpen}
        className="min-w-0"
      >
        <ul className="flex flex-wrap gap-2">
          {group.tickers.map((ticker) => (
            <PremarketTickerRow
              key={ticker.symbol}
              ticker={ticker}
              threshold={threshold}
              onOpen={() => setDetailTicker(ticker)}
            />
          ))}
        </ul>
      </CollapsibleSection>

      {detailTicker && (
        <PremarketTickerDetailModal
          group={group}
          ticker={detailTicker}
          threshold={threshold}
          onClose={() => setDetailTicker(null)}
        />
      )}
    </>
  );
}
