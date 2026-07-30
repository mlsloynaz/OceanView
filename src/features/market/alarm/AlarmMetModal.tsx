import { MarketDetailModal } from "@/features/market/components/MarketDetailModal";
import { formatAlarmTrend, type MarketAlarmWatch } from "./alarm-types";

type Props = {
  watch: MarketAlarmWatch;
  onClose: () => void;
  /** Reset met status so the watch can fire again (optionally resume polling). */
  onClearStatus?: (restart: boolean) => void;
};

export function AlarmMetModal({ watch, onClose, onClearStatus }: Props) {
  const side =
    watch.lastDetectedTrend === "alcista" || watch.lastDetectedTrend === "bajista"
      ? watch.lastDetectedTrend
      : watch.trend;
  return (
    <MarketDetailModal
      open
      onClose={onClose}
      title={`Alarm: ${watch.symbol}`}
      subtitle={`${watch.ruleLabel} · ${formatAlarmTrend(side)}`}
    >
      <div className="space-y-3 text-sm text-ocean-foam">
        <p className="text-base font-semibold text-ocean-teal-dim dark:text-ocean-teal">
          Rule met — polling stopped
          {side === "alcista" || side === "bajista" ? ` (${formatAlarmTrend(side)})` : ""}.
        </p>
        {watch.lastEvidence ? (
          <p className="text-ocean-sand">{watch.lastEvidence}</p>
        ) : null}
        {typeof watch.lastBreakoutScore === "number" ? (
          <p className="text-xs text-ocean-sand">Score {Math.round(watch.lastBreakoutScore)}</p>
        ) : null}
        {watch.metAt ? (
          <p className="text-xs text-ocean-sand">
            Met at {new Date(watch.metAt).toLocaleString()}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-1">
          {onClearStatus ? (
            <>
              <button
                type="button"
                onClick={() => onClearStatus(true)}
                className="rounded-md bg-ocean-teal px-3 py-1.5 text-xs font-semibold text-ocean-deep hover:brightness-105"
              >
                Clear & resume
              </button>
              <button
                type="button"
                onClick={() => onClearStatus(false)}
                className="rounded-md border border-ocean-mid/50 px-3 py-1.5 text-xs font-semibold text-ocean-foam hover:bg-ocean-mid/20"
              >
                Clear status
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-ocean-mid/40 px-3 py-1.5 text-xs font-semibold text-ocean-sand hover:bg-ocean-mid/15"
          >
            Dismiss
          </button>
        </div>
        {onClearStatus ? (
          <p className="text-[11px] text-ocean-sand/90">
            Clear removes the met highlight so this watch can alarm again. Resume starts polling
            immediately.
          </p>
        ) : null}
      </div>
    </MarketDetailModal>
  );
}
