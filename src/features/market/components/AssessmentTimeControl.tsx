import type { CandleCoverage } from "../types";
import {
  blocksAssess,
  coverageBoundsForInput,
  formatAssessmentDisplay,
  formatEtDatetimeLocal,
  type AssessmentTimeMode,
} from "../lib/assessment-time";
import {
  assessmentToLiveSimulate,
  liveSimulateToAssessment,
} from "@/shared/components/SimulationTimeControl";
import { LiveSimulateControl } from "@/shared/components/LiveSimulateControl";
import { cn } from "@/shared/lib/cn";

export type PollIntervalUnit = "min" | "sec";

type Props = {
  mode: AssessmentTimeMode;
  value: Date;
  coverage: CandleCoverage;
  error: string | null;
  notice: string | null;
  pending: boolean;
  refreshPending: boolean;
  monitorActive: boolean;
  stopPending: boolean;
  canStop: boolean;
  intervalValue: number;
  intervalUnit: PollIntervalUnit;
  onIntervalValueChange: (value: number) => void;
  onIntervalUnitChange: (unit: PollIntervalUnit) => void;
  liveEnabled?: boolean;
  simulateEnabled?: boolean;
  onModeChange: (mode: AssessmentTimeMode) => void;
  onChange: (value: string) => void;
  onAssess: () => void;
  onStartPolling: () => void;
  onStop: () => void;
  onRefreshResult: () => void;
  className?: string;
};

export function AssessmentTimeControl({
  mode,
  value,
  coverage,
  error,
  notice,
  pending,
  refreshPending,
  monitorActive,
  stopPending,
  canStop,
  intervalValue,
  intervalUnit,
  onIntervalValueChange,
  onIntervalUnitChange,
  liveEnabled = true,
  simulateEnabled = true,
  onModeChange,
  onChange,
  onAssess,
  onStartPolling,
  onStop,
  onRefreshResult,
  className,
}: Props) {
  const assessAt = mode === "now" ? new Date() : value;
  const outOfCoverage = blocksAssess(assessAt, coverage, { historicalOnly: mode === "et" });
  const busy = pending || stopPending;
  const assessDisabled = busy || monitorActive || outOfCoverage;
  const startDisabled = busy || monitorActive || outOfCoverage;
  const intervalDisabled = monitorActive || stopPending;
  const bounds = coverageBoundsForInput(coverage);
  const intervalLabel = intervalUnit === "min" ? "min" : "sec";

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <LiveSimulateControl
          mode={assessmentToLiveSimulate(mode)}
          onModeChange={(next) => onModeChange(liveSimulateToAssessment(next))}
          disabled={false}
          inputDisabled={false}
          liveEnabled={liveEnabled}
          simulateEnabled={simulateEnabled}
          variant="default"
          simulateInput="datetime"
          simulateValue={formatEtDatetimeLocal(value)}
          onSimulateChange={onChange}
          simulateInputId="market-assessment-time"
          simulateInputError={Boolean(error)}
          simulateMin={bounds.min}
          simulateMax={bounds.max}
          showLiveClock
          liveHint="at assess"
          ariaLabel="Assessment time mode"
        />

        <button
          type="button"
          onClick={onAssess}
          disabled={assessDisabled}
          title={
            monitorActive
              ? "Continuous assess is running — hit Stop first"
              : outOfCoverage
                ? mode === "et"
                  ? "Assessment time is outside stored candle history"
                  : "Assessment time is before earliest candle data"
                : mode === "now"
                  ? "Run one assessment at the current Eastern time"
                  : "Run one assessment at the selected time"
          }
          className="rounded-md bg-ocean-teal px-2.5 py-1 text-[11px] font-semibold text-ocean-deep transition-colors hover:brightness-105 disabled:opacity-40"
        >
          {pending && !monitorActive ? "…" : "Assess"}
        </button>

        <button
          type="button"
          onClick={onStartPolling}
          disabled={startDisabled}
          title={
            monitorActive
              ? "Continuous assess is already running — hit Stop first"
              : `Start continuous assess every ${intervalValue} ${intervalLabel}`
          }
          className="rounded-md border border-ocean-teal/50 bg-ocean-deep px-2.5 py-1 text-[11px] font-semibold text-ocean-teal-dim transition-colors hover:border-ocean-teal hover:text-ocean-teal disabled:opacity-40 dark:text-ocean-teal"
        >
          {pending && monitorActive ? "…" : "Start"}
        </button>

        <label
          htmlFor="market-assess-interval"
          className="flex items-center gap-1 text-[11px] text-ocean-sand"
        >
          Every
          <input
            id="market-assess-interval"
            type="number"
            min={1}
            max={intervalUnit === "min" ? 60 : 3600}
            step={1}
            value={intervalValue}
            disabled={intervalDisabled}
            onChange={(e) => {
              const next = Number.parseInt(e.target.value, 10);
              if (!Number.isNaN(next)) onIntervalValueChange(next);
            }}
            className="w-14 rounded-md border border-ocean-mid/50 bg-ocean-deep px-2 py-1 text-[11px] tabular-nums text-ocean-foam focus:border-ocean-teal/60 focus:outline-none disabled:opacity-50"
          />
          <select
            aria-label="Interval unit"
            value={intervalUnit}
            disabled={intervalDisabled}
            onChange={(e) => onIntervalUnitChange(e.target.value === "sec" ? "sec" : "min")}
            className="rounded-md border border-ocean-mid/50 bg-ocean-deep px-1.5 py-1 text-[11px] text-ocean-foam focus:border-ocean-teal/60 focus:outline-none disabled:opacity-50"
          >
            <option value="min">min</option>
            <option value="sec">sec</option>
          </select>
        </label>

        <button
          type="button"
          onClick={onStop}
          disabled={!canStop || stopPending}
          title={
            monitorActive
              ? "Stop continuous assess and cancel any in-flight run"
              : "Request stop after the current symbol"
          }
          className="rounded-md border border-ocean-mid/60 bg-ocean-deep px-2.5 py-1 text-[11px] font-semibold text-ocean-foam transition-colors hover:border-ocean-teal/50 disabled:opacity-40"
        >
          {stopPending ? "Stopping…" : "Stop"}
        </button>

        <button
          type="button"
          onClick={onRefreshResult}
          disabled={refreshPending || stopPending}
          className="rounded-md border border-ocean-mid/60 bg-ocean-deep px-2.5 py-1 text-[11px] font-semibold text-ocean-foam transition-colors hover:border-ocean-teal/50 disabled:opacity-40"
        >
          {refreshPending ? "Loading…" : "Refresh result"}
        </button>
      </div>

      {monitorActive ? (
        <p className="mt-1 text-[11px] text-ocean-teal-dim dark:text-ocean-teal" role="status">
          Monitoring — next assess every {intervalValue} {intervalLabel} · result refresh ~20s after
          each assess starts
          {mode === "et" ? " · Simulate mode reuses the same assessment time each tick" : ""}
          . Strategies outside their entry window are skipped.
        </p>
      ) : null}

      {mode === "now" ? (
        <p className="mt-1 text-[10px] text-ocean-sand/70">
          Live mode uses the current Eastern time during the session; after hours it assesses at 4:00
          PM ET. Candles refresh from Schwab when stored data is behind.
        </p>
      ) : (
        <p className="mt-1 text-[10px] text-ocean-sand/70">
          Simulate — stored regular-session candles from Dynamo only, sliced through the selected
          time (9:30 AM–4:00 PM ET, no refresh).
        </p>
      )}

      {error ? (
        <p id="market-assessment-time-error" className="mt-1 text-[11px] text-ocean-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-1 text-[11px] text-ocean-teal-dim dark:text-ocean-teal">{notice}</p>
      ) : null}
      {!error && !notice ? (
        <p className="mt-1 text-[10px] text-ocean-sand/70">
          Candles: {formatAssessmentDisplay(new Date(coverage.earliestAt))}
          {" – "}
          {formatAssessmentDisplay(new Date(coverage.latestAt))}
        </p>
      ) : null}
    </div>
  );
}
