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
  running: boolean;
  startPending: boolean;
  stopPending: boolean;
  tickerCount: number;
  moveCapPct: number;
  polledAt?: string | null;
  error?: string | null;
  onStart: () => void;
  onStop: () => void;
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
        disabled={!monitor.canStart}
        onClick={(e) => {
          e.stopPropagation();
          monitor.onStart();
        }}
      >
        {monitor.startPending ? "Starting…" : "Start"}
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
        {monitor.stopPending ? "Stopping…" : "Stop"}
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
  } | null>(null);

  if (hits.length === 0) return null;

  const countLabel = `${hits.length} ticker${hits.length === 1 ? "" : "s"}`;
  const statusLine = monitor?.running
    ? `Monitoring ${monitor.tickerCount} · last scan ${formatPolledAt(monitor.polledAt)} · move cap ${monitor.moveCapPct}%`
    : `Top 10 by max quality · ${countLabel} · move cap ${monitor?.moveCapPct ?? 12}%`;

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
