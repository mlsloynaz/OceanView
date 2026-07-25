import { Link } from "react-router-dom";
import { cn } from "@/shared/lib/cn";
import { SimulationTimeControl } from "@/shared/components/SimulationTimeControl";
import { PollControls } from "@/shared/components/PollControls";
import type { AssessmentTimeMode } from "@/features/market/lib/assessment-time";
import { formatPremarketStatus, formatSimTimeEt } from "../display";
import type { PremarketResultResponse } from "../types";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  isAdmin?: boolean;
  result: PremarketResultResponse | null;
  activeStrategyCount: number;
  evaluateGroupLabel: string;
  evaluateRunning: boolean;
  canStopEvaluate: boolean;
  startPending: boolean;
  stopPending: boolean;
  monitorActive: boolean;
  intervalMinutes: number;
  onIntervalMinutesChange: (value: number) => void;
  loading: boolean;
  threshold: number;
  onThresholdChange: (value: number) => void;
  assessmentMode: AssessmentTimeMode;
  assessmentAt: Date;
  assessmentError: string | null;
  assessmentNotice: string | null;
  coverageMin?: string;
  coverageMax?: string;
  onAssessmentModeChange: (mode: AssessmentTimeMode) => void;
  onAssessmentTimeChange: (localValue: string) => void;
  onEvaluateAdhoc: () => void;
  onStart: () => void;
  onStop: () => void;
  onRefresh: () => void;
};

const THRESHOLD_PRESETS = [0, 50, 75] as const;

export function PremarketToolbar({
  isAdmin = false,
  result,
  activeStrategyCount,
  evaluateGroupLabel,
  evaluateRunning,
  canStopEvaluate,
  startPending,
  stopPending,
  monitorActive,
  intervalMinutes,
  onIntervalMinutesChange,
  loading,
  threshold,
  onThresholdChange,
  assessmentMode,
  assessmentAt,
  assessmentError,
  assessmentNotice,
  coverageMin,
  coverageMax,
  onAssessmentModeChange,
  onAssessmentTimeChange,
  onEvaluateAdhoc,
  onStart,
  onStop,
  onRefresh,
}: Props) {
  const busy = evaluateRunning || stopPending || loading;
  const evaluateControlsBusy = evaluateRunning || stopPending;
  const adhocDisabled =
    monitorActive || busy || activeStrategyCount === 0 || Boolean(assessmentError);
  const startDisabled =
    monitorActive || busy || activeStrategyCount === 0 || Boolean(assessmentError);
  const intervalDisabled = monitorActive || stopPending;
  const adhocPending = startPending && !monitorActive;
  const startLoopPending = startPending && monitorActive;

  return (
    <div className="space-y-3 rounded-xl border border-ocean-mid/50 bg-ocean-surface p-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-ocean-foam">Evaluate strategies</h2>
        <p className="mt-0.5 text-xs text-ocean-sand">
          Run active <strong className="text-ocean-foam">dynamic strategies</strong> against all
          active tickers
          {activeStrategyCount > 0 ? (
            <>
              {" "}
              — {evaluateGroupLabel}
            </>
          ) : null}
          . Standard playbooks are evaluated on{" "}
          <Link to="/market" className="text-ocean-teal hover:underline">
            Market
          </Link>{" "}
          only.
          {isAdmin ? " Manage dynamic screens in Strategy builder below." : null} Extended-hours
          bars stay in memory only.
        </p>
      </div>

      <SimulationTimeControl
        mode={assessmentMode}
        value={assessmentAt}
        disabled={evaluateControlsBusy}
        inputDisabled={false}
        simulateInputError={Boolean(assessmentError)}
        simulateMin={coverageMin}
        simulateMax={coverageMax}
        inputId="premarket-evaluate-time"
        onModeChange={onAssessmentModeChange}
        onChange={onAssessmentTimeChange}
      />
      {assessmentError ? (
        <p className="text-[11px] text-ocean-danger">{assessmentError}</p>
      ) : assessmentNotice ? (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">{assessmentNotice}</p>
      ) : (
        <p className="text-[10px] text-ocean-sand/70">
          {assessmentMode === "now"
            ? "Live — Schwab bars including pre/post market (in memory only, never saved to Admin candles)."
            : "Simulate — stored regular-session candles from Dynamo only, sliced through the selected time (9:30 AM–4:00 PM ET, no refresh)."}
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
          disabled={adhocDisabled}
          title={
            monitorActive
              ? "Continuous evaluate is already running — hit Stop first"
              : activeStrategyCount === 0
                ? "Activate at least one dynamic strategy first"
                : `Run one evaluate of ${activeStrategyCount} dynamic strateg${activeStrategyCount === 1 ? "y" : "ies"} (no interval polling)`
          }
          onClick={onEvaluateAdhoc}
        >
          {adhocPending ? "Evaluating…" : "Evaluate adhoc"}
        </button>
        <PollControls
          density="default"
          monitorActive={monitorActive}
          startPending={startPending}
          stopPending={stopPending}
          canStop={canStopEvaluate}
          refreshPending={loading}
          intervalValue={intervalMinutes}
          intervalUnit="min"
          units={["min"]}
          intervalMax={60}
          onIntervalValueChange={onIntervalMinutesChange}
          onStart={onStart}
          onStop={onStop}
          onRefresh={onRefresh}
          showRefresh
          startDisabled={startDisabled}
          intervalDisabled={intervalDisabled}
          intervalInputId="premarket-evaluate-interval"
          startLabel={startLoopPending ? "Evaluating…" : "Start"}
          refreshLabel={loading ? "Loading…" : "Refresh result"}
          monitoringMessage={
            monitorActive
              ? `Monitoring — next evaluate every ${intervalMinutes} min · result refresh ~20s after each assess starts${
                  assessmentMode === "et"
                    ? " · Simulate mode reuses the same assessment time each tick"
                    : ""
                }`
              : null
          }
          ariaLabel="Continuous evaluate"
          className="inline-flex flex-wrap items-center"
        />
        <span className="ml-auto text-xs text-ocean-sand">
          {activeStrategyCount} active dynamic strateg{activeStrategyCount === 1 ? "y" : "ies"}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ocean-sand">
        <span>
          Status:{" "}
          <strong className="text-ocean-foam">
            {monitorActive && !startPending
              ? "Monitoring"
              : adhocPending
                ? "Evaluating…"
                : startLoopPending
                  ? "Starting…"
                  : formatPremarketStatus(result?.status)}
          </strong>
        </span>
        {result?.progress?.total != null && result.progress.total > 0 && (
          <span>
            Progress:{" "}
            <strong className="text-ocean-foam">
              {result.progress.completed ?? 0}/{result.progress.total}
            </strong>
          </span>
        )}
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
