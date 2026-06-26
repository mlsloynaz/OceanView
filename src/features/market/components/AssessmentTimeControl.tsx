import type { CandleCoverage } from "../types";
import {
  coverageBoundsForInput,
  formatAssessmentDisplay,
  formatEtDatetimeLocal,
  isAssessmentNow,
} from "../lib/assessment-time";
import { cn } from "@/shared/lib/cn";

type Props = {
  value: Date;
  coverage: CandleCoverage;
  error: string | null;
  pending: boolean;
  onChange: (value: string) => void;
  onNow: () => void;
  onAssess: () => void;
  className?: string;
};

export function AssessmentTimeControl({
  value,
  coverage,
  error,
  pending,
  onChange,
  onNow,
  onAssess,
  className,
}: Props) {
  const { min, max } = coverageBoundsForInput(coverage);
  const atNow = isAssessmentNow(value);
  const inputValue = formatEtDatetimeLocal(value);

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
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
            "rounded-md border bg-ocean-surface py-1.5 pl-2 pr-1 text-sm text-ocean-foam tabular-nums",
            "focus:border-ocean-teal/40 focus:outline-none focus:ring-1 focus:ring-ocean-teal/20",
            error ? "border-ocean-danger-border" : "border-ocean-mid/40",
          )}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "market-assessment-time-error" : undefined}
        />
        <span className="text-[11px] text-ocean-sand">ET</span>
        <button
          type="button"
          onClick={onNow}
          disabled={atNow}
          className="rounded-md border border-ocean-mid/40 px-2 py-1 text-[11px] font-medium text-ocean-sand transition-colors hover:border-ocean-teal/40 hover:text-ocean-foam disabled:opacity-40"
          title="Reset to current time"
        >
          Now
        </button>
        <button
          type="button"
          onClick={onAssess}
          disabled={Boolean(error) || pending}
          className="rounded-md bg-ocean-teal px-2.5 py-1 text-[11px] font-semibold text-ocean-deep transition-colors hover:brightness-105 disabled:opacity-40"
        >
          {pending ? "…" : "Assess"}
        </button>
      </div>
      {error ? (
        <p id="market-assessment-time-error" className="mt-1 text-[11px] text-ocean-danger">
          {error}
        </p>
      ) : (
        <p className="mt-1 text-[10px] text-ocean-sand/70">
          Candles: {formatAssessmentDisplay(new Date(coverage.earliestAt))}
          {" – "}
          {formatAssessmentDisplay(new Date(coverage.latestAt))}
        </p>
      )}
    </div>
  );
}
