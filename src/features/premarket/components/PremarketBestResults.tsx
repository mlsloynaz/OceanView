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
  canScan: boolean;
  canRefresh: boolean;
  running: boolean;
  startPending: boolean;
  stopPending: boolean;
  scanPending: boolean;
  refreshPending: boolean;
  tickerCount: number;
  moveCapPct: number;
  polledAt?: string | null;
  error?: string | null;
  notice?: string | null;
  onStart: () => void;
  onStop: () => void;
  onScan: () => void;
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

function formatPolledAt(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "shortGeneric",
    });
  } catch {
    return iso;
  }
}

function MonitorHeaderActions({ monitor }: { monitor: MonitorControls }): ReactNode {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-110")}
        disabled={!monitor.canRefresh}
        title="Refresh candles, reassess these tickers, and resolve option picks once"
        onClick={(e) => {
          e.stopPropagation();
          monitor.onRefresh();
        }}
      >
        {monitor.refreshPending ? "Refreshing…" : "Refresh best results"}
      </button>
      <button
        type="button"
        className={cn(BTN, "border border-ocean-mid/50 text-ocean-foam hover:bg-ocean-mid/20")}
        disabled={!monitor.canStart}
        title="Load option picks once (no continuous polling)"
        onClick={(e) => {
          e.stopPropagation();
          monitor.onStart();
        }}
      >
        {monitor.startPending ? "Loading…" : "Load strikes"}
      </button>
      <button
        type="button"
        className={cn(BTN, "border border-ocean-mid/50 text-ocean-foam hover:bg-ocean-mid/20")}
        disabled={!monitor.canScan}
        title="One scan of option chains for current session"
        onClick={(e) => {
          e.stopPropagation();
          monitor.onScan();
        }}
      >
        {monitor.scanPending ? "Scanning…" : "Scan strikes"}
      </button>
      <button
        type="button"
        className={cn(
          BTN,
          "border border-ocean-danger/50 text-ocean-danger hover:bg-ocean-danger/10",
        )}
        disabled={!monitor.canStop}
        onClick={(e) => {
          e.stopPropagation();
          monitor.onStop();
        }}
      >
        {monitor.stopPending ? "Clearing…" : "Clear"}
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
  } | null>(null);

  if (hits.length === 0) return null;

  const countLabel = `${hits.length} ticker${hits.length === 1 ? "" : "s"}`;
  const statusLine = monitor?.running
    ? `Strikes loaded · ${monitor.tickerCount} · last update ${formatPolledAt(monitor.polledAt)}`
    : `Top 10 by max quality · ${countLabel} · use Refresh for candles + reassess + options`;

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
        {monitor?.error ? (
          <p className="mb-2 text-xs text-ocean-danger" role="alert">
            {monitor.error}
          </p>
        ) : null}
        {monitor?.notice ? (
          <p className="mb-2 text-xs text-ocean-sand" role="status">
            {monitor.notice}
          </p>
        ) : null}
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
                movementProfile: hit.movementProfile ?? hit.bestTicker.movementProfile,
              }}
              threshold={threshold}
              strategyScores={hit.strategies}
              monitor={resolveMonitor?.(hit.symbol, hit.direction) ?? null}
              priceDetail="trade"
              onOpenRules={() =>
                setDetail({
                  group: hit.bestGroup,
                  ticker: {
                    ...hit.bestTicker,
                    movementProfile:
                      hit.movementProfile ?? hit.bestTicker.movementProfile,
                  },
                  monitor: resolveMonitor?.(hit.symbol, hit.direction) ?? null,
                })
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
          monitor={detail.monitor}
          priceDetail="trade"
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}
