import type { MarketViewMode } from "../types";
import { cn } from "@/shared/lib/cn";

type Props = {
  mode: MarketViewMode;
  onChange: (mode: MarketViewMode) => void;
};

const BTN =
  "rounded px-2 py-1 text-[11px] font-medium transition-colors";

const MODES: { id: MarketViewMode; label: string }[] = [
  { id: "strategies", label: "By strategy" },
  { id: "tickers", label: "By ticker" },
  { id: "rules", label: "By rule" },
  { id: "alarm", label: "Alarm" },
];

export function MarketViewToggle({ mode, onChange }: Props) {
  return (
    <div
      className="flex w-full flex-wrap gap-0.5 rounded-md border border-ocean-mid/40 bg-ocean-deep/30 p-0.5 sm:inline-flex sm:w-auto"
      role="group"
      aria-label="Market view mode"
    >
      {MODES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={cn(
            BTN,
            "min-w-0 flex-1 sm:flex-none",
            mode === id
              ? "bg-ocean-teal text-ocean-deep shadow-sm"
              : "text-ocean-sand hover:text-ocean-foam",
          )}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
