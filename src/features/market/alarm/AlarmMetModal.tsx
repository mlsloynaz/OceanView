import { MarketDetailModal } from "@/features/market/components/MarketDetailModal";
import { formatAlarmTrend, type MarketAlarmWatch } from "./alarm-types";

type Props = {
  watch: MarketAlarmWatch;
  onClose: () => void;
};

export function AlarmMetModal({ watch, onClose }: Props) {
  return (
    <MarketDetailModal
      open
      onClose={onClose}
      title={`Alarm: ${watch.symbol}`}
      subtitle={`${watch.ruleLabel} · ${formatAlarmTrend(watch.trend)}`}
    >
      <div className="space-y-3 text-sm text-ocean-foam">
        <p className="text-base font-semibold text-ocean-teal-dim dark:text-ocean-teal">
          Rule met — polling stopped.
        </p>
        {watch.lastEvidence ? (
          <p className="text-ocean-sand">{watch.lastEvidence}</p>
        ) : null}
        {watch.metAt ? (
          <p className="text-xs text-ocean-sand">
            Met at {new Date(watch.metAt).toLocaleString()}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-ocean-teal px-3 py-1.5 text-xs font-semibold text-ocean-deep hover:brightness-105"
        >
          Dismiss
        </button>
      </div>
    </MarketDetailModal>
  );
}
