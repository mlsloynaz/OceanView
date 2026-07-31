import { cn } from "@/shared/lib/cn";
import { TODAY_MODE_LABELS, TODAY_MODES, type TodayMode } from "../lib/today-routes";

type Props = {
  mode: TodayMode;
  onChange: (mode: TodayMode) => void;
};

export function TodayModeTabs({ mode, onChange }: Props) {
  return (
    <div
      className="inline-flex flex-wrap gap-1 rounded-lg border border-ocean-mid/50 bg-ocean-deep/30 p-1"
      role="tablist"
      aria-label="Today mode"
    >
      {TODAY_MODES.map((item) => {
        const active = item === mode;
        return (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-ocean-teal text-ocean-deep"
                : "text-ocean-sand hover:bg-ocean-mid/40 hover:text-ocean-foam",
            )}
          >
            {TODAY_MODE_LABELS[item]}
          </button>
        );
      })}
    </div>
  );
}
