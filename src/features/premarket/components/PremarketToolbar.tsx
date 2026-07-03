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
  threshold: number;
  onThresholdChange: (value: number) => void;
  assessmentMode: AssessmentTimeMode;
  assessmentAt: Date;
  assessmentError: string | null;
  onAssessmentModeChange: (mode: AssessmentTimeMode) => void;
  onAssessmentTimeChange: (localValue: string) => void;
  onStart: () => void;
  onStop: () => void;
  onRefresh: () => void;
};

const THRESHOLD_PRESETS = [0, 50, 75] as const;

export function PremarketToolbar({
  result,
  activeStrategyCount,
  evaluateRunning,
  startPending,
  stopPending,
  loading,
  threshold,
  onThresholdChange,
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
            ? "Now — live Schwab bars including pre/post market (in memory only, never saved to Admin candles)."
            : "ET — stored regular-session candles from Dynamo only (9:30 AM–4:00 PM, no pre/post data)."}
        </p>
      )}

      <div className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <label htmlFor="premarket-quality-threshold" className="text-xs font-medium text-ocean-foam">
            Quality threshold
          </label>
          <div className="flex items-center gap-1.5">
            <input
              id="premarket-quality-threshold"
              type="number"
              min={0}
              max={100}
              step={5}
              value={threshold}
              disabled={busy}
              onChange={(e) => {
                const next = Number.parseInt(e.target.value, 10);
                if (!Number.isNaN(next)) onThresholdChange(next);
              }}
              className="w-16 rounded-md border border-ocean-mid/50 bg-ocean-deep px-2 py-1 text-xs tabular-nums text-ocean-foam focus:border-ocean-teal/60 focus:outline-none disabled:opacity-50"
            />
            <span className="text-xs text-ocean-sand">%</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {THRESHOLD_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={busy}
                onClick={() => onThresholdChange(preset)}
                className={cn(
                  "rounded px-2 py-0.5 text-[10px] font-semibold transition-colors disabled:opacity-50",
                  threshold === preset
                    ? "bg-ocean-teal/20 text-ocean-teal-dim dark:text-ocean-teal"
                    : "border border-ocean-mid/50 text-ocean-sand hover:border-ocean-teal/40 hover:text-ocean-foam",
                )}
              >
                {preset === 0 ? "All" : `${preset}%`}
              </button>
            ))}
          </div>
          {result?.signalThresholdPct != null && result.signalThresholdPct !== threshold && (
            <span className="text-[10px] text-ocean-sand">
              Last run used {result.signalThresholdPct}%
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[10px] text-ocean-sand/70">
          {threshold === 0
            ? "0% lists every evaluated ticker. Raise the threshold to hide tickers below that quality score."
            : `Only tickers with quality ≥ ${threshold}% appear in results. Green badges use this threshold.`}
        </p>
      </div>

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
        {result?.signalThresholdPct != null && (
          <span>
            Threshold:{" "}
            <strong className="text-ocean-foam">{result.signalThresholdPct}%</strong>
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
