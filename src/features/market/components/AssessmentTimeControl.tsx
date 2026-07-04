import { useEffect, useState } from "react";
import type { CandleCoverage } from "../types";
import {
  blocksAssess,
  coverageBoundsForInput,
  formatAssessmentDisplay,
  formatEtDatetimeLocal,
  type AssessmentTimeMode,
} from "../lib/assessment-time";
import { cn } from "@/shared/lib/cn";

type Props = {
  mode: AssessmentTimeMode;
  value: Date;
  coverage: CandleCoverage;
  error: string | null;
  notice: string | null;
  pending: boolean;
  refreshPending: boolean;
  onModeChange: (mode: AssessmentTimeMode) => void;
  onChange: (value: string) => void;
  onAssess: () => void;
  onRefreshResult: () => void;
  className?: string;
};

const MODE_BTN =
  "rounded px-2.5 py-1 text-[11px] font-semibold transition-colors min-w-[3.25rem]";

function AssessmentModeToggle({
  mode,
  onChange,
}: {
  mode: AssessmentTimeMode;
  onChange: (mode: AssessmentTimeMode) => void;
}) {
  return (
    <div
      className="inline-flex shrink-0 rounded-md border border-ocean-mid/40 bg-ocean-deep/30 p-0.5"
      role="radiogroup"
      aria-label="Assessment time mode"
    >
      <button
        type="button"
        role="radio"
        aria-checked={mode === "now"}
        className={cn(
          MODE_BTN,
          mode === "now"
            ? "bg-ocean-teal text-ocean-deep shadow-sm"
            : "text-ocean-sand hover:text-ocean-foam",
        )}
        onClick={() => onChange("now")}
      >
        Now
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === "et"}
        className={cn(
          MODE_BTN,
          mode === "et"
            ? "bg-ocean-teal text-ocean-deep shadow-sm"
            : "text-ocean-sand hover:text-ocean-foam",
        )}
        onClick={() => onChange("et")}
      >
        ET
      </button>
    </div>
  );
}

function LiveEtClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="text-sm tabular-nums text-ocean-foam" aria-live="polite">
      {formatAssessmentDisplay(now)}
    </span>
  );
}

export function AssessmentTimeControl({
  mode,
  value,
  coverage,
  error,
  notice,
  pending,
  refreshPending,
  onModeChange,
  onChange,
  onAssess,
  onRefreshResult,
  className,
}: Props) {
  const { min, max } = coverageBoundsForInput(coverage);
  const inputValue = formatEtDatetimeLocal(value);
  const assessAt = mode === "now" ? new Date() : value;
  const assessDisabled = pending || blocksAssess(assessAt, coverage, { historicalOnly: mode === "et" });

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <AssessmentModeToggle mode={mode} onChange={onModeChange} />

        {mode === "now" ? (
          <div className="flex min-w-0 flex-wrap items-baseline gap-1.5">
            <LiveEtClock />
            <span className="text-[11px] text-ocean-sand">at assess</span>
          </div>
        ) : (
          <>
            <label className="sr-only" htmlFor="market-assessment-time">
              Assessment time (Eastern)
            </label>
            <input
              id="market-assessment-time"
              type="datetime-local"
              value={inputValue}
              min={min}
              max={max}
              onChange={(e) => onChange(e.target.value)}
              className={cn(
                "min-w-[11rem] rounded-md border bg-ocean-surface py-1.5 pl-2 pr-1 text-sm text-ocean-foam tabular-nums",
                "focus:border-ocean-teal/40 focus:outline-none focus:ring-1 focus:ring-ocean-teal/20",
                error ? "border-ocean-danger-border" : "border-ocean-mid/40",
              )}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "market-assessment-time-error" : undefined}
              required
            />
            <span className="text-[11px] text-ocean-sand">ET</span>
          </>
        )}

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
          Now mode uses the current Eastern time during the session; after hours it assesses at 4:00 PM ET.
        </p>
      ) : (
        <p className="mt-1 text-[10px] text-ocean-sand/70">
          ET mode uses stored candle history only — bars through the time you enter.
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
