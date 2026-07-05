import { useEffect, useState } from "react";
import { cn } from "@/shared/lib/cn";
import {
  formatAssessmentDisplay,
  parseEtDatetimeLocal,
} from "@/features/market/lib/assessment-time";

export type LiveSimulateMode = "live" | "simulate";

type Props = {
  mode: LiveSimulateMode;
  onModeChange: (mode: LiveSimulateMode) => void;
  /** Disables Live/Simulate toggle buttons. */
  disabled?: boolean;
  /** Disables the simulate date/time input (defaults to `disabled`). */
  inputDisabled?: boolean;
  liveEnabled?: boolean;
  simulateEnabled?: boolean;
  variant?: "compact" | "default";
  simulateInput?: "date" | "datetime";
  simulateValue?: string;
  onSimulateChange?: (value: string) => void;
  simulateInputId?: string;
  simulateLabel?: string;
  simulateMin?: string;
  simulateMax?: string;
  simulateInputError?: boolean;
  showLiveClock?: boolean;
  liveHint?: string;
  className?: string;
  ariaLabel?: string;
};

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

export function LiveSimulateControl({
  mode,
  onModeChange,
  disabled = false,
  inputDisabled,
  liveEnabled = true,
  simulateEnabled = true,
  variant = "default",
  simulateInput,
  simulateValue = "",
  onSimulateChange,
  simulateInputId = "live-simulate-input",
  simulateLabel,
  simulateMin,
  simulateMax,
  simulateInputError = false,
  showLiveClock = true,
  liveHint,
  className,
  ariaLabel = "Live or simulate mode",
}: Props) {
  const simulateFieldDisabled = inputDisabled ?? disabled;
  const [draftValue, setDraftValue] = useState(simulateValue);

  useEffect(() => {
    setDraftValue(simulateValue);
  }, [simulateValue, mode]);

  const isCompact = variant === "compact";
  const toggleWrap = cn(
    "inline-flex shrink-0 items-center gap-1",
    isCompact
      ? "rounded border border-ocean-mid/50 bg-ocean-deep/60 p-0.5 text-[11px]"
      : "rounded-md border border-ocean-mid/40 bg-ocean-deep/30 p-0.5",
  );
  const btnBase = cn(
    "font-semibold transition-colors",
    isCompact ? "rounded px-2 py-0.5 font-medium" : "rounded px-2.5 py-1 text-[11px] min-w-[3.25rem]",
    disabled && "opacity-50",
  );
  const btnActive = isCompact
    ? "bg-ocean-teal/20 text-ocean-foam"
    : "bg-ocean-teal text-ocean-deep shadow-sm";
  const btnInactive = "text-ocean-sand hover:text-ocean-foam";

  const showSimulateInput = mode === "simulate" && simulateInput && onSimulateChange;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className={toggleWrap} role="radiogroup" aria-label={ariaLabel}>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "live"}
          disabled={disabled || !liveEnabled}
          className={cn(
            btnBase,
            mode === "live" ? btnActive : btnInactive,
            !liveEnabled && "cursor-not-allowed opacity-40",
          )}
          onClick={() => liveEnabled && onModeChange("live")}
        >
          Live
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "simulate"}
          disabled={disabled || !simulateEnabled}
          className={cn(
            btnBase,
            mode === "simulate" ? btnActive : btnInactive,
            !simulateEnabled && "cursor-not-allowed opacity-40",
          )}
          onClick={() => simulateEnabled && onModeChange("simulate")}
        >
          Simulate
        </button>
      </div>

      {mode === "live" && showLiveClock ? (
        <div className="flex min-w-0 flex-wrap items-baseline gap-1.5">
          <LiveEtClock />
          {liveHint ? <span className="text-[11px] text-ocean-sand">{liveHint}</span> : null}
        </div>
      ) : null}

      {showSimulateInput ? (
        <label
          className={cn(
            "flex items-center gap-1",
            isCompact ? "text-[11px] text-ocean-sand" : "contents",
          )}
        >
          {simulateLabel ? (
            <span className={isCompact ? undefined : "sr-only"}>{simulateLabel}</span>
          ) : (
            <span className="sr-only">Simulation time (Eastern)</span>
          )}
          <input
            id={simulateInputId}
            type={simulateInput}
            value={draftValue}
            min={simulateMin}
            max={simulateMax}
            disabled={simulateFieldDisabled}
            onChange={(e) => {
              const next = e.target.value;
              setDraftValue(next);
              onSimulateChange?.(next);
            }}
            onBlur={() => {
              const trimmed = draftValue.trim();
              if (!trimmed) {
                setDraftValue(simulateValue);
                return;
              }
              if (simulateInput === "datetime" && parseEtDatetimeLocal(trimmed)) {
                return;
              }
              if (simulateInput === "date" && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                return;
              }
              setDraftValue(simulateValue);
            }}
            className={cn(
              isCompact
                ? "rounded border border-ocean-mid/60 bg-ocean-deep px-1 py-0.5 text-ocean-foam"
                : cn(
                    "min-w-[11rem] rounded-md border bg-ocean-surface py-1.5 pl-2 pr-1 text-sm text-ocean-foam tabular-nums",
                    "focus:border-ocean-teal/40 focus:outline-none focus:ring-1 focus:ring-ocean-teal/20",
                    simulateInputError ? "border-ocean-danger-border" : "border-ocean-mid/40",
                  ),
              simulateFieldDisabled && "opacity-50",
            )}
            aria-invalid={simulateInputError || undefined}
          />
          {simulateInput === "datetime" && !isCompact ? (
            <span className="text-[11px] text-ocean-sand">ET</span>
          ) : null}
        </label>
      ) : null}
    </div>
  );
}
