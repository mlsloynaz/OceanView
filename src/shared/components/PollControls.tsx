import { cn } from "@/shared/lib/cn";

export type PollIntervalUnit = "sec" | "min" | "hour";

export type PollControlsProps = {
  monitorActive: boolean;
  startPending?: boolean;
  stopPending?: boolean;
  canStop: boolean;
  refreshPending?: boolean;

  intervalValue: number;
  intervalUnit: PollIntervalUnit;
  onIntervalValueChange: (value: number) => void;
  onIntervalUnitChange?: (unit: PollIntervalUnit) => void;
  /** Units shown in the selector. Default: min + sec. */
  units?: PollIntervalUnit[];
  intervalMin?: number;
  intervalMax?: number;

  onStart: () => void;
  onStop: () => void;
  onRefresh?: () => void;

  startDisabled?: boolean;
  intervalDisabled?: boolean;
  startLabel?: string;
  stopLabel?: string;
  refreshLabel?: string;
  showRefresh?: boolean;
  /** compact = Market 11px; default = Premarket text-xs */
  density?: "compact" | "default";
  monitoringMessage?: string | null;
  className?: string;
  intervalInputId?: string;
  /** Extra aria label for the control group */
  ariaLabel?: string;
};

const UNIT_LABEL: Record<PollIntervalUnit, string> = {
  sec: "sec",
  min: "min",
  hour: "hour",
};

function defaultMax(unit: PollIntervalUnit): number {
  if (unit === "sec") return 3600;
  if (unit === "hour") return 24;
  return 60;
}

export function PollControls({
  monitorActive,
  startPending = false,
  stopPending = false,
  canStop,
  refreshPending = false,
  intervalValue,
  intervalUnit,
  onIntervalValueChange,
  onIntervalUnitChange,
  units = ["min", "sec"],
  intervalMin = 1,
  intervalMax,
  onStart,
  onStop,
  onRefresh,
  startDisabled = false,
  intervalDisabled = false,
  startLabel = "Start",
  stopLabel = "Stop",
  refreshLabel = "Refresh result",
  showRefresh = false,
  density = "compact",
  monitoringMessage = null,
  className,
  intervalInputId = "poll-interval",
  ariaLabel = "Polling controls",
}: PollControlsProps) {
  const compact = density === "compact";
  const btn = compact
    ? "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
    : "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const inputCls = compact
    ? "w-14 rounded-md border border-ocean-mid/50 bg-ocean-deep px-2 py-1 text-[11px] tabular-nums text-ocean-foam focus:border-ocean-teal/60 focus:outline-none disabled:opacity-50"
    : "w-14 rounded-md border border-ocean-mid/50 bg-ocean-deep px-2 py-1 text-xs tabular-nums text-ocean-foam focus:border-ocean-teal/60 focus:outline-none disabled:opacity-50";
  const labelCls = compact ? "text-[11px] text-ocean-sand" : "text-xs text-ocean-sand";
  const max = intervalMax ?? defaultMax(intervalUnit);
  const intervalLocked = intervalDisabled || monitorActive || stopPending;
  const startLocked = startDisabled || monitorActive || startPending || stopPending;
  const showUnitSelect = units.length > 1 && onIntervalUnitChange;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={ariaLabel}>
        <label htmlFor={intervalInputId} className={cn("flex items-center gap-1.5", labelCls)}>
          Every
          <input
            id={intervalInputId}
            type="number"
            min={intervalMin}
            max={max}
            step={1}
            value={intervalValue}
            disabled={intervalLocked}
            onChange={(e) => {
              const next = Number.parseInt(e.target.value, 10);
              if (!Number.isNaN(next)) onIntervalValueChange(next);
            }}
            className={inputCls}
          />
          {showUnitSelect ? (
            <select
              aria-label="Interval unit"
              value={intervalUnit}
              disabled={intervalLocked}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "sec" || v === "min" || v === "hour") onIntervalUnitChange?.(v);
              }}
              className={cn(
                inputCls,
                "w-auto",
                compact ? "px-1.5" : "px-2",
              )}
            >
              {units.map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABEL[u]}
                </option>
              ))}
            </select>
          ) : (
            <span>{UNIT_LABEL[intervalUnit]}</span>
          )}
        </label>

        <button
          type="button"
          onClick={onStart}
          disabled={startLocked}
          title={
            monitorActive
              ? "Already running — hit Stop first"
              : `Start polling every ${intervalValue} ${UNIT_LABEL[intervalUnit]}`
          }
          className={cn(
            btn,
            "border border-ocean-teal/50 bg-ocean-deep text-ocean-teal-dim hover:border-ocean-teal hover:text-ocean-teal dark:text-ocean-teal",
          )}
        >
          {startPending && monitorActive ? "…" : startLabel}
        </button>

        <button
          type="button"
          onClick={onStop}
          disabled={!canStop || stopPending}
          title="Stop polling"
          className={cn(
            btn,
            "border border-ocean-mid/60 bg-ocean-deep text-ocean-foam hover:border-ocean-teal/50",
          )}
        >
          {stopPending ? "Stopping…" : stopLabel}
        </button>

        {showRefresh && onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshPending || stopPending}
            className={cn(
              btn,
              "border border-ocean-mid/60 bg-ocean-deep text-ocean-foam hover:border-ocean-teal/50",
            )}
          >
            {refreshPending ? "Loading…" : refreshLabel}
          </button>
        ) : null}
      </div>

      {monitorActive && monitoringMessage ? (
        <p className={cn(compact ? "text-[11px]" : "text-xs", "text-ocean-teal-dim dark:text-ocean-teal")} role="status">
          {monitoringMessage}
        </p>
      ) : null}
    </div>
  );
}

export function pollIntervalToMs(value: number, unit: PollIntervalUnit): number {
  const safe = Math.max(1, Math.floor(value) || 1);
  if (unit === "sec") return safe * 1000;
  if (unit === "hour") return safe * 60 * 60 * 1000;
  return safe * 60 * 1000;
}

export function clampPollInterval(value: number, unit: PollIntervalUnit, min = 1): number {
  if (!Number.isFinite(value)) return Math.max(min, unit === "sec" ? 5 : 1);
  const max = defaultMax(unit);
  const floor = unit === "sec" ? Math.max(min, 5) : min;
  return Math.max(floor, Math.min(max, Math.round(value)));
}
