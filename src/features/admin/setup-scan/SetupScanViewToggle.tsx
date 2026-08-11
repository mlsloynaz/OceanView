import { cn } from "@/shared/lib/cn";

export type SetupScanViewMode = "tickers" | "strategies";

type Props = {
  mode: SetupScanViewMode;
  onChange: (mode: SetupScanViewMode) => void;
  disabled?: boolean;
};

const BTN =
  "rounded px-2 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const MODES: { id: SetupScanViewMode; label: string }[] = [
  { id: "tickers", label: "By ticker" },
  { id: "strategies", label: "By strategy" },
];

export function SetupScanViewToggle({ mode, onChange, disabled }: Props) {
  return (
    <div
      className="inline-flex rounded-md border border-ocean-mid/50 p-0.5"
      role="group"
      aria-label="SemiFinal result grouping"
    >
      {MODES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          disabled={disabled}
          className={cn(
            BTN,
            mode === id
              ? "bg-ocean-teal text-ocean-deep"
              : "text-ocean-sand hover:bg-ocean-mid/20",
          )}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
