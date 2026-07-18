import { useState } from "react";
import { CollapsibleSection } from "@/shared/components/CollapsibleSection";
import type {
  BestResultMonitorTicker,
  PremarketBestHit,
  PremarketStrategyGroup,
} from "../types";
import { PremarketTickerDetailModal } from "./PremarketTickerDetailModal";
import { PremarketTickerRow } from "./PremarketTickerRow";

type Props = {
  hits: PremarketBestHit[];
  threshold: number;
  defaultOpen?: boolean;
  resolveMonitor?: (
    symbol: string,
    direction?: PremarketBestHit["direction"],
  ) => BestResultMonitorTicker | null;
};

export function PremarketBestResults({
  hits,
  threshold,
  defaultOpen = true,
  resolveMonitor,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [detail, setDetail] = useState<{
    group: PremarketStrategyGroup;
    ticker: PremarketBestHit["bestTicker"];
  } | null>(null);

  if (hits.length === 0) return null;

  const countLabel = `${hits.length} ticker${hits.length === 1 ? "" : "s"}`;
  const subtitle = `Top 10 by max quality · ${countLabel}`;

  return (
    <>
      <CollapsibleSection
        id="premarket-best-results"
        title="Best results"
        subtitle={subtitle}
        open={open}
        onOpenChange={setOpen}
        className="premarket-result min-w-0"
      >
        <ul className="flex flex-wrap gap-2">
          {hits.map((hit) => (
            <PremarketTickerRow
              key={`${hit.symbol}|${hit.direction ?? "NONE"}`}
              ticker={{
                ...hit.bestTicker,
                symbol: hit.symbol,
                name: hit.name,
                direction: hit.direction,
                qualityPct: hit.qualityPct,
              }}
              threshold={threshold}
              strategyScores={hit.strategies}
              monitor={resolveMonitor?.(hit.symbol, hit.direction) ?? null}
              onOpen={() =>
                setDetail({ group: hit.bestGroup, ticker: hit.bestTicker })
              }
            />
          ))}
        </ul>
      </CollapsibleSection>

      {detail && (
        <PremarketTickerDetailModal
          group={detail.group}
          ticker={detail.ticker}
          threshold={threshold}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}
