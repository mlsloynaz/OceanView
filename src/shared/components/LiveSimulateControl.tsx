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
  /** Disables Live/Simulate toggle buttons only. */
  disabled?: boolean;
  /** Disables simulate date/time inputs (default: never — inputs stay editable). */
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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;

function splitDatetimeLocal(value: string): { date: string; time: string } {
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return {
    date: match?.[1] ?? "",
    time: match?.[2] ?? "09:30",
  };
}

function joinDatetimeLocal(date: string, time: string): string {
  return `${date}T${normalizeTimeHm(time) ?? time}`;
}

function normalizeTimeHm(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function boundDate(bound: string | undefined): string | undefined {
  if (!bound) return undefined;
  return bound.length >= 10 ? bound.slice(0, 10) : bound;
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

/** Text fields stay typeable on Windows (native date/time pickers often block typing). */
const fieldClass = (error: boolean, fieldDisabled: boolean) =>
  cn(
    "relative z-10 rounded border border-ocean-mid/60 bg-ocean-deep px-1.5 py-0.5 text-ocean-foam",
    "focus:border-ocean-teal/50 focus:outline-none",
    "[color-scheme:dark]",
    error && "border-ocean-danger-border",
    fieldDisabled && "cursor-not-allowed opacity-50",
  );

export function LiveSimulateControl({
  mode,
  onModeChange,
  disabled = false,
  inputDisabled = false,
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
  const parsed = splitDatetimeLocal(simulateValue);
  const [dateDraft, setDateDraft] = useState(parsed.date);
  const [timeDraft, setTimeDraft] = useState(parsed.time);

  useEffect(() => {
    setDateDraft(parsed.date);
    setTimeDraft(parsed.time);
  }, [parsed.date, parsed.time]);

  const isCompact = variant === "compact";
  const toggleWrap = cn(
    "inline-flex shrink-0 items-center gap-1",
    isCompact
      ? "rounded border border-ocean-mid/50 bg-ocean-deep/60 p-0.5 text-[11px]"
      : "rounded-md border border-ocean-mid/40 bg-ocean-deep/30 p-0.5",
  );
  const btnBase = cn(
    "border font-semibold transition-colors",
    isCompact ? "rounded px-2 py-0.5 font-medium" : "rounded px-2.5 py-1 text-[11px] min-w-[3.25rem]",
    disabled && "opacity-50",
  );
  // Active = teal border only (no solid fill — Assess stays the only primary CTA).
  const btnActive = "border-ocean-teal bg-transparent text-ocean-teal";
  const btnInactive =
    "border-transparent text-ocean-sand hover:border-ocean-mid/50 hover:text-ocean-foam";

  const showSimulateInput = mode === "simulate" && simulateInput && onSimulateChange;
  const dateMin = boundDate(simulateMin);
  const dateMax = boundDate(simulateMax);

  const commitDatetime = (date: string, time: string) => {
    const normalizedTime = normalizeTimeHm(time);
    if (!DATE_RE.test(date) || !normalizedTime) return false;
    const combined = joinDatetimeLocal(date, normalizedTime);
    if (!parseEtDatetimeLocal(combined)) return false;
    onSimulateChange?.(combined);
    return true;
  };

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
        simulateInput === "datetime" ? (
          <div
            className={cn(
              "relative flex flex-wrap items-center gap-1",
              "text-[11px] text-ocean-sand",
            )}
          >
            <label htmlFor={simulateInputId} className="shrink-0">
              Session
            </label>
            <input
              id={simulateInputId}
              type="text"
              inputMode="numeric"
              placeholder="YYYY-MM-DD"
              autoComplete="off"
              spellCheck={false}
              value={dateDraft}
              min={dateMin}
              max={dateMax}
              disabled={inputDisabled}
              aria-invalid={simulateInputError || undefined}
              title="Session date (YYYY-MM-DD) — type or paste"
              className={cn(fieldClass(simulateInputError, inputDisabled), "w-[7.25rem] tabular-nums")}
              onChange={(e) => {
                const date = e.target.value;
                setDateDraft(date);
                if (DATE_RE.test(date)) commitDatetime(date, timeDraft);
              }}
              onBlur={() => {
                if (!commitDatetime(dateDraft, timeDraft)) setDateDraft(parsed.date);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!commitDatetime(dateDraft, timeDraft)) setDateDraft(parsed.date);
                }
              }}
            />
            <label htmlFor={`${simulateInputId}-time`} className="shrink-0">
              Time
            </label>
            <input
              id={`${simulateInputId}-time`}
              type="text"
              inputMode="numeric"
              placeholder="HH:MM"
              autoComplete="off"
              spellCheck={false}
              value={timeDraft}
              disabled={inputDisabled}
              aria-invalid={simulateInputError || undefined}
              title="Eastern time (24h HH:MM) — type freely, e.g. 12:00 or 09:30"
              className={cn(fieldClass(simulateInputError, inputDisabled), "w-[4.5rem] tabular-nums")}
              onChange={(e) => {
                const time = e.target.value;
                setTimeDraft(time);
                if (normalizeTimeHm(time) && dateDraft) commitDatetime(dateDraft, time);
              }}
              onBlur={() => {
                const normalized = normalizeTimeHm(timeDraft);
                if (normalized && commitDatetime(dateDraft || parsed.date, normalized)) {
                  setTimeDraft(normalized);
                } else {
                  setTimeDraft(parsed.time);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const normalized = normalizeTimeHm(timeDraft);
                  if (normalized && commitDatetime(dateDraft || parsed.date, normalized)) {
                    setTimeDraft(normalized);
                  } else {
                    setTimeDraft(parsed.time);
                  }
                }
              }}
            />
            <span className="shrink-0">ET</span>
          </div>
        ) : (
          <div className="relative flex items-center gap-1 text-[11px] text-ocean-sand">
            <label htmlFor={simulateInputId} className="shrink-0">
              {simulateLabel ?? "Session"}
            </label>
            <input
              id={simulateInputId}
              type="text"
              inputMode="numeric"
              placeholder="YYYY-MM-DD"
              autoComplete="off"
              spellCheck={false}
              value={simulateValue}
              disabled={inputDisabled}
              aria-invalid={simulateInputError || undefined}
              className={cn(fieldClass(simulateInputError, inputDisabled), "w-[7.25rem] tabular-nums")}
              onChange={(e) => onSimulateChange?.(e.target.value)}
            />
          </div>
        )
      ) : null}
    </div>
  );
}
