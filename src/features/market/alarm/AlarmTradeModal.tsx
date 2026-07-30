import { MarketDetailModal } from "@/features/market/components/MarketDetailModal";
import { formatAlarmTrend, type AlarmPopupKind, type MarketAlarmWatch } from "./alarm-types";

type Props = {
  watch: MarketAlarmWatch;
  kind: AlarmPopupKind;
  onClose: () => void;
  /** Enter: start monitoring for exit. Exit: reset watch so it can alarm again. */
  onConfirm: () => void;
};

export function AlarmTradeModal({ watch, kind, onClose, onConfirm }: Props) {
  const side =
    watch.lastDetectedTrend === "alcista" || watch.lastDetectedTrend === "bajista"
      ? watch.lastDetectedTrend
      : watch.trend;
  const sideLabel =
    side === "alcista" || side === "bajista" ? formatAlarmTrend(side) : formatAlarmTrend(watch.trend);
  const isEnter = kind === "enter";
  const evidence = isEnter ? watch.lastEvidence : watch.exitEvidence ?? watch.lastEvidence;
  const when = isEnter ? watch.metAt : watch.exitedAt;

  return (
    <MarketDetailModal
      open
      onClose={onClose}
      title={isEnter ? `Enter: ${watch.symbol}` : `Exit: ${watch.symbol}`}
      subtitle={`${watch.ruleLabel} · ${sideLabel}`}
    >
      <div className="space-y-3 text-sm text-ocean-foam">
        <p
          className={
            isEnter
              ? "text-base font-semibold text-ocean-teal-dim dark:text-ocean-teal"
              : "text-base font-semibold text-amber-700 dark:text-amber-200"
          }
        >
          {isEnter
            ? `ENTER now — rule met (${sideLabel}).`
            : `EXIT now — setup no longer met (${sideLabel}).`}
        </p>
        {evidence ? <p className="text-ocean-sand">{evidence}</p> : null}
        {typeof watch.lastBreakoutScore === "number" ? (
          <p className="text-xs text-ocean-sand">Score {Math.round(watch.lastBreakoutScore)}</p>
        ) : null}
        {when ? (
          <p className="text-xs text-ocean-sand">
            {isEnter ? "Signal at" : "Exit at"} {new Date(when).toLocaleString()}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={onConfirm}
            className={
              isEnter
                ? "rounded-md bg-ocean-teal px-3 py-1.5 text-xs font-semibold text-ocean-deep hover:brightness-105"
                : "rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-ocean-deep hover:brightness-105"
            }
          >
            {isEnter ? "Entered — watch for exit" : "Exited — arm again"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-ocean-mid/40 px-3 py-1.5 text-xs font-semibold text-ocean-sand hover:bg-ocean-mid/15"
          >
            Dismiss
          </button>
        </div>
        <p className="text-[11px] text-ocean-sand/90">
          {isEnter
            ? "Confirm after you enter. Polling continues and will alert when the setup drops (exit)."
            : "Confirm after you exit. This watch resets and can fire a new enter alarm."}
        </p>
      </div>
    </MarketDetailModal>
  );
}
