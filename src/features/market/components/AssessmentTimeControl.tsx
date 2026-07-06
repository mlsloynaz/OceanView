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

type Props = {
  mode: AssessmentTimeMode;
  value: Date;
  coverage: CandleCoverage;
  error: string | null;
  notice: string | null;
  pending: boolean;
  refreshPending: boolean;
  liveEnabled?: boolean;
  simulateEnabled?: boolean;
  onModeChange: (mode: AssessmentTimeMode) => void;
  onChange: (value: string) => void;
  onAssess: () => void;
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
  liveEnabled = true,
  simulateEnabled = true,
  onModeChange,
  onChange,
  onAssess,
  onRefreshResult,
  className,
}: Props) {
  const assessAt = mode === "now" ? new Date() : value;
  const assessDisabled = pending || blocksAssess(assessAt, coverage, { historicalOnly: mode === "et" });
  const bounds = coverageBoundsForInput(coverage);

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
            blocksAssess(assessAt, coverage, { historicalOnly: mode === "et" })
              ? mode === "et"
                ? "Assessment time is outside stored candle history"
                : "Assessment time is before earliest candle data"
              : mode === "now"
                ? "Run assessment at the current Eastern time"
                : undefined
          }
          className="rounded-md bg-ocean-teal px-2.5 py-1 text-[11px] font-semibold text-ocean-deep transition-colors hover:brightness-105 disabled:opacity-40"
        >
          {pending ? "…" : "Assess"}
        </button>
        <button
          type="button"
          onClick={onRefreshResult}
          disabled={refreshPending}
          className="rounded-md border border-ocean-mid/60 bg-ocean-deep px-2.5 py-1 text-[11px] font-semibold text-ocean-foam transition-colors hover:border-ocean-teal/50 disabled:opacity-40"
        >
          {refreshPending ? "Loading…" : "Refresh result"}
        </button>
      </div>

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
