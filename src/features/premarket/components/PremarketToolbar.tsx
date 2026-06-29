import { cn } from "@/shared/lib/cn";
import { formatPremarketStatus, formatSimTimeEt } from "../display";
import type { PremarketResultResponse } from "../types";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  result: PremarketResultResponse | null;
  startPending: boolean;
  stopPending: boolean;
  loading: boolean;
  threshold: number;
  onStart: () => void;
  onStop: () => void;
  onRefresh: () => void;
};

export function PremarketToolbar({
  result,
  startPending,
  stopPending,
  loading,
  threshold,
  onStart,
  onStop,
  onRefresh,
}: Props) {
  const busy = startPending || stopPending || loading;

  return (
    <div className="space-y-3 rounded-xl border border-ocean-mid/50 bg-ocean-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-105")}
          disabled={busy || startPending}
          onClick={onStart}
        >
          {startPending ? "Evaluating…" : "Start evaluate"}
        </button>
        <button
          type="button"
          className={cn(
            BTN,
            "border border-ocean-mid/60 bg-ocean-deep text-ocean-foam hover:border-ocean-teal/50",
          )}
          disabled={!startPending || stopPending}
          onClick={onStop}
          title="Request stop after the current symbol"
        >
          {stopPending ? "Stopping…" : "Stop"}
        </button>
        <button
          type="button"
          className={cn(
            BTN,
            "border border-ocean-mid/60 bg-ocean-deep text-ocean-foam hover:border-ocean-teal/50",
          )}
          disabled={busy}
          onClick={onRefresh}
        >
          {loading ? "Loading…" : "Refresh result"}
        </button>
        <span className="ml-auto text-xs text-ocean-sand">Threshold: {threshold}%</span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ocean-sand">
        <span>
          Status:{" "}
          <strong className="text-ocean-foam">
            {startPending ? "Running" : formatPremarketStatus(result?.status)}
          </strong>
        </span>
        {result?.simulationTimeEt && (
          <span>
            Sim: <strong className="text-ocean-foam">{formatSimTimeEt(result.simulationTimeEt)}</strong>
          </span>
        )}
        {result?.runId && (
          <span className="truncate" title={result.runId}>
            Run: <code className="text-[11px] text-ocean-teal-dim dark:text-ocean-teal">{result.runId}</code>
          </span>
        )}
        {result?.stopped && (
          <span className="text-amber-600 dark:text-amber-400">Stopped early — partial results</span>
        )}
      </div>
    </div>
  );
}
