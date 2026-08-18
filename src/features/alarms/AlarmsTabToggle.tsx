import { cn } from "@/shared/lib/cn";
import { ALARMS_TABS, ALARMS_TAB_LABELS, type AlarmsTab } from "./lib/alarm-routes";

type Props = {
  tab: AlarmsTab;
  onChange: (tab: AlarmsTab) => void;
};

const BTN = "rounded px-3 py-1.5 text-[11px] font-medium transition-colors";

export function AlarmsTabToggle({ tab, onChange }: Props) {
  return (
    <div
      className="flex w-full flex-wrap gap-0.5 rounded-md border border-ocean-mid/40 bg-ocean-deep/30 p-0.5 sm:inline-flex sm:w-auto"
      role="group"
      aria-label="Alarm board"
    >
      {ALARMS_TABS.map((id) => (
        <button
          key={id}
          type="button"
          className={cn(
            BTN,
            "min-w-0 flex-1 sm:flex-none",
            tab === id
              ? "bg-ocean-teal text-ocean-deep shadow-sm"
              : "text-ocean-sand hover:text-ocean-foam",
          )}
          onClick={() => onChange(id)}
        >
          {ALARMS_TAB_LABELS[id]}
        </button>
      ))}
    </div>
  );
}
