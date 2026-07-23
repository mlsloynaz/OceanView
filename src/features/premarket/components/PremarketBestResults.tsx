import { useState, type ReactNode } from "react";
import { CollapsibleSection } from "@/shared/components/CollapsibleSection";
import { cn } from "@/shared/lib/cn";
import type {
  BestResultMonitorTicker,
  PremarketBestHit,
  PremarketStrategyGroup,
} from "../types";
import { PremarketTickerDetailModal } from "./PremarketTickerDetailModal";
import { PremarketTickerRow } from "./PremarketTickerRow";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type MonitorControls = {
  canStart: boolean;
  canStop: boolean;
  canRefresh: boolean;
  running: boolean;
  monitoring: boolean;
  startPending: boolean;
  stopPending: boolean;
  refreshPending: boolean;
  tickerCount: number;
  moveCapPct: number;
  polledAt?: string | null;
  error?: string | null;
  notice?: string | null;
  onStart: () => void;
  onStop: () => void;
  onRefresh: () => void;
};

type Props = {
  hits: PremarketBestHit[];
  threshold: number;
  defaultOpen?: boolean;
  resolveMonitor?: (
    symbol: string,
    direction?: PremarketBestHit["direction"],
  ) => BestResultMonitorTicker | null;
  monitor?: MonitorControls;
};

function MonitorHeaderActions({ monitor }: { monitor: MonitorControls }): ReactNode {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-110")}
        disabled={!monitor.canRefresh}
        title="Refresh candles and reassess these tickers (strategy quality only — no option chains)"
        onClick={(e) => {
          e.stopPropagation();
          monitor.onRefresh();
        }}
      >
        {monitor.refreshPending ? "Refreshing…" : "Refresh best results"}
      </button>
    </div>
  );
}

export function PremarketBestResults({
  hits,
  threshold,
  defaultOpen = true,
  resolveMonitor,
  monitor,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [detail, setDetail] = useState<{
    group: PremarketStrategyGroup;
    ticker: PremarketBestHit["bestTicker"];
    monitor: BestResultMonitorTicker | null;
    pick: PremarketBestHit["pick"];
    spot: PremarketBestHit["spot"];
  } | null>(null);

  if (hits.length === 0) return null;

  const countLabel = `${hits.length} ticker${hits.length === 1 ? "" : "s"}`;
  const statusLine = `Top 10 by strategy quality · ${countLabel} · Refresh to reassess (no option feasibility)`;

  return (
    <>
      <CollapsibleSection
        id="premarket-best-results"
        title="Best results"
        subtitle={statusLine}
        open={open}
        onOpenChange={setOpen}
        className="premarket-result min-w-0"
        headerExtra={monitor ? <MonitorHeaderActions monitor={monitor} /> : undefined}
      >
        {(monitor?.error || monitor?.notice) && (
          <div className="mb-3 space-y-1 px-1 text-xs">
            {monitor.error ? (
              <p className="text-ocean-danger" role="alert">
                {monitor.error}
              </p>
            ) : null}
            {monitor.notice ? <p className="text-ocean-sand">{monitor.notice}</p> : null}
          </div>
        )}
        <ul className="space-y-2">
          {hits.map((hit) => {
            const mon =
              resolveMonitor?.(hit.bestTicker.symbol, hit.direction) ??
              resolveMonitor?.(hit.bestTicker.symbol) ??
              null;
            return (
              <PremarketTickerRow
                key={`${hit.bestTicker.symbol}-${hit.direction ?? "NONE"}`}
                ticker={hit.bestTicker}
                threshold={threshold}
                strategyScores={hit.strategies}
                monitor={mon}
                assessPick={hit.pick}
                assessSpot={hit.spot}
                priceDetail="trade"
                onOpenRules={() =>
                  setDetail({
                    group: hit.bestGroup,
                    ticker: hit.bestTicker,
                    monitor: mon,
                    pick: hit.pick,
                    spot: hit.spot,
                  })
                }
              />
            );
          })}
        </ul>
      </CollapsibleSection>

      {detail && (
        <PremarketTickerDetailModal
          group={detail.group}
          ticker={detail.ticker}
          threshold={threshold}
          monitor={detail.monitor}
          assessPick={detail.pick}
          assessSpot={detail.spot}
          priceDetail="trade"
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}
