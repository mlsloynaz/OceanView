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
import {
  PollControls,
  type PollIntervalUnit,
} from "@/shared/components/PollControls";
import { cn } from "@/shared/lib/cn";

export type { PollIntervalUnit };

const BTN =
  "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";
const BTN_PRIMARY = cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-105");

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
  const bounds = coverageBoundsForInput(coverage);
  const intervalLabel = intervalUnit === "min" ? "min" : "sec";

  return (
    <div className={cn("min-w-0 space-y-2", className)}>
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
          className={BTN_PRIMARY}
        >
          {pending && !monitorActive ? "Assessing…" : "Assess"}
        </button>
      </div>

      <PollControls
        density="compact"
        monitorActive={monitorActive}
        startPending={pending}
        stopPending={stopPending}
        canStop={canStop}
        refreshPending={refreshPending}
        intervalValue={intervalValue}
        intervalUnit={intervalUnit === "hour" ? "min" : intervalUnit}
        units={["min", "sec"]}
        onIntervalValueChange={onIntervalValueChange}
        onIntervalUnitChange={(u) => onIntervalUnitChange(u === "sec" ? "sec" : "min")}
        onStart={onStartPolling}
        onStop={onStop}
        onRefresh={onRefreshResult}
        showRefresh
        startDisabled={busy || outOfCoverage}
        intervalInputId="market-assess-interval"
        monitoringMessage={
          monitorActive
            ? `Monitoring — next assess every ${intervalValue} ${intervalLabel}${
                mode === "et" ? " · Simulate reuses the same time each tick" : ""
              }. Results update when each run finishes. Strategies outside their entry window are skipped.`
            : null
        }
        ariaLabel="Continuous assess"
      />

      {mode === "now" ? (
        <p className="text-[10px] text-ocean-sand/70">
          Live mode uses the current Eastern time during the session; after hours it assesses at 4:00
          PM ET. Candles refresh from Schwab when stored data is behind.
        </p>
      ) : (
        <p className="text-[10px] text-ocean-sand/70">
          Simulate — stored regular-session candles from Dynamo only, sliced through the selected
          time (9:30 AM–4:00 PM ET, no refresh). Type session as YYYY-MM-DD and time as HH:MM (24h
          ET).
        </p>
      )}

      {error ? (
        <p id="market-assessment-time-error" className="text-[11px] text-ocean-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-[11px] text-ocean-teal-dim dark:text-ocean-teal">{notice}</p>
      ) : null}
      {!error && !notice ? (
        <p className="text-[10px] text-ocean-sand/70">
          Candles: {formatAssessmentDisplay(new Date(coverage.earliestAt))}
          {" – "}
          {formatAssessmentDisplay(new Date(coverage.latestAt))}
        </p>
      ) : null}
    </div>
  );
}
