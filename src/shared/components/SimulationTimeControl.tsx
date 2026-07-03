import { useEffect, useState } from "react";
import { cn } from "@/shared/lib/cn";
import {
  formatAssessmentDisplay,
  formatEtDatetimeLocal,
  type AssessmentTimeMode,
} from "@/features/market/lib/assessment-time";

const MODE_BTN =
  "rounded px-2.5 py-1 text-[11px] font-semibold transition-colors min-w-[3.25rem]";

type Props = {
  mode: AssessmentTimeMode;
  value: Date;
  disabled?: boolean;
  inputId?: string;
  onModeChange: (mode: AssessmentTimeMode) => void;
  onChange: (localValue: string) => void;
  className?: string;
};

function ModeToggle({
  mode,
  disabled,
  onChange,
}: {
  mode: AssessmentTimeMode;
  disabled?: boolean;
  onChange: (mode: AssessmentTimeMode) => void;
}) {
  return (
    <div
      className="inline-flex shrink-0 rounded-md border border-ocean-mid/40 bg-ocean-deep/30 p-0.5"
      role="radiogroup"
      aria-label="Simulation time mode"
    >
      <button
        type="button"
        role="radio"
        aria-checked={mode === "now"}
        disabled={disabled}
        className={cn(
          MODE_BTN,
          mode === "now"
            ? "bg-ocean-teal text-ocean-deep shadow-sm"
            : "text-ocean-sand hover:text-ocean-foam",
          disabled && "opacity-50",
        )}
        onClick={() => onChange("now")}
      >
        Now
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === "et"}
        disabled={disabled}
        className={cn(
          MODE_BTN,
          mode === "et"
            ? "bg-ocean-teal text-ocean-deep shadow-sm"
            : "text-ocean-sand hover:text-ocean-foam",
          disabled && "opacity-50",
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

/** Now / ET toggle with optional Eastern datetime picker (no Assess button). */
export function SimulationTimeControl({
  mode,
  value,
  disabled,
  inputId = "simulation-time",
  onModeChange,
  onChange,
  className,
}: Props) {
  const inputValue = formatEtDatetimeLocal(value);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <ModeToggle mode={mode} disabled={disabled} onChange={onModeChange} />

      {mode === "now" ? (
        <div className="flex min-w-0 items-baseline gap-1.5">
          <LiveEtClock />
          <span className="text-[11px] text-ocean-sand">at evaluate</span>
        </div>
      ) : (
        <>
          <label className="sr-only" htmlFor={inputId}>
            Simulation time (Eastern)
          </label>
          <input
            id={inputId}
            type="datetime-local"
            value={inputValue}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              "min-w-[11rem] rounded-md border border-ocean-mid/40 bg-ocean-surface py-1.5 pl-2 pr-1 text-sm text-ocean-foam tabular-nums",
              "focus:border-ocean-teal/40 focus:outline-none focus:ring-1 focus:ring-ocean-teal/20",
              disabled && "opacity-50",
            )}
            required
          />
          <span className="text-[11px] text-ocean-sand">ET</span>
        </>
      )}
    </div>
  );
}
