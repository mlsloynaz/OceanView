import { cn } from "@/shared/lib/cn";
import { SimulationTimeControl } from "@/shared/components/SimulationTimeControl";
import type { AssessmentTimeMode } from "@/features/market/lib/assessment-time";
import { formatPremarketStatus, formatSimTimeEt } from "../display";
import type { PremarketResultResponse } from "../types";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  result: PremarketResultResponse | null;
  activeStrategyCount: number;
  evaluateRunning: boolean;
  startPending: boolean;
  stopPending: boolean;
  loading: boolean;
  assessmentMode: AssessmentTimeMode;
  assessmentAt: Date;
  assessmentError: string | null;
  onAssessmentModeChange: (mode: AssessmentTimeMode) => void;
  onAssessmentTimeChange: (localValue: string) => void;
  onStart: () => void;
  onStop: () => void;
  onRefresh: () => void;
};

export function PremarketToolbar({
  result,
  activeStrategyCount,
  evaluateRunning,
  startPending,
  stopPending,
  loading,
  assessmentMode,
  assessmentAt,
  assessmentError,
  onAssessmentModeChange,
  onAssessmentTimeChange,
  onStart,
  onStop,
  onRefresh,
}: Props) {
  const busy = evaluateRunning || stopPending || loading;
  const evaluateDisabled =
    busy || activeStrategyCount === 0 || Boolean(assessmentError);

  return (
    <div className="space-y-3 rounded-xl border border-ocean-mid/50 bg-ocean-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ocean-foam">Evaluate strategies</h2>
          <p className="mt-0.5 text-xs text-ocean-sand">
            Run all active dynamic strategies against active tickers. Extended-hours bars stay in memory
            only.
          </p>
        </div>
      </div>

      <SimulationTimeControl
        mode={assessmentMode}
        value={assessmentAt}
        disabled={busy}
        inputId="premarket-evaluate-time"
        onModeChange={onAssessmentModeChange}
        onChange={onAssessmentTimeChange}
      />
      {assessmentError ? (
        <p className="text-[11px] text-ocean-danger">{assessmentError}</p>
      ) : (
        <p className="text-[10px] text-ocean-sand/70">
          {assessmentMode === "now"
            ? "Now evaluates at the current Eastern time with live extended-hours bars (not stored in Admin candles)."
            : "ET uses stored candle history only — bars through the time you enter."}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-105")}
          disabled={evaluateDisabled}
          title={
            evaluateRunning
              ? "An evaluate run is already in progress"
              : activeStrategyCount === 0
                ? "Activate at least one dynamic strategy first"
                : `Evaluate ${activeStrategyCount} active strateg${activeStrategyCount === 1 ? "y" : "ies"}`
          }
          onClick={onStart}
        >
          {startPending ? "Evaluating…" : "Evaluate strategies"}
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
        <span className="ml-auto text-xs text-ocean-sand">
          {activeStrategyCount} active
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ocean-sand">
        <span>
          Status:{" "}
          <strong className="text-ocean-foam">
            {startPending ? "Running" : formatPremarketStatus(result?.status)}
          </strong>
        </span>
        {result?.evaluatedAt && (
          <span>
            Ran:{" "}
            <strong className="text-ocean-foam">{formatSimTimeEt(result.evaluatedAt)}</strong>
          </span>
        )}
        {result?.simulationTimeEt && (
          <span title="Bars sliced to this Eastern time">
            Bars as of:{" "}
            <strong className="text-ocean-foam">{formatSimTimeEt(result.simulationTimeEt)}</strong>
          </span>
        )}
        {result?.runId && (
          <span className="truncate" title={result.runId}>
            Run:{" "}
            <code className="text-[11px] text-ocean-teal-dim dark:text-ocean-teal">{result.runId}</code>
          </span>
        )}
        {result?.stopped && (
          <span className="text-amber-600 dark:text-amber-400">Stopped early — partial results</span>
        )}
      </div>
    </div>
  );
}
