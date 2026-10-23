import { useState } from "react";
import {
  calc10,
  calc20,
  calc35,
  calc50,
  calc75,
  calc100,
  calcRisk,
  formatCalcResult,
} from "@/shared/lib/price-calc";
import { cn } from "@/shared/lib/cn";

const PERCENTS = [
  { label: "35%", title: "× 1.35 + 0.02", calc: calc35, primary: true },
  { label: "20%", title: "× 1.2 + 0.02", calc: calc20, primary: false },
  { label: "10%", title: "× 1.1 + 0.02", calc: calc10, primary: false },
  { label: "50%", title: "× 1.5 + 0.02", calc: calc50, primary: false },
  { label: "75%", title: "× 1.75 + 0.02", calc: calc75, primary: false },
  { label: "100%", title: "× 2 + 0.02", calc: calc100, primary: false },
] as const;

export function PriceCalc() {
  const [input, setInput] = useState("");
  const [lastLabel, setLastLabel] = useState<string | null>(null);

  const value = parseFloat(input);
  const valid = Number.isFinite(value);
  const rRisk = valid ? calcRisk(value) : null;

  function select(label: string) {
    if (!valid) return;
    setLastLabel(label);
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        inputMode="decimal"
        enterKeyHint="done"
        autoComplete="off"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="0.00"
        aria-label="Amount to calculate"
        className="min-h-12 w-full rounded-lg border border-ocean-mid/60 bg-ocean-deep px-3 py-2.5 text-base font-medium text-ocean-foam placeholder:text-ocean-sand/50 focus:border-ocean-teal focus:outline-none focus:ring-2 focus:ring-ocean-teal/30"
      />

      <div className="grid grid-cols-1 gap-2">
        {PERCENTS.map((percent) => {
          const result = valid ? percent.calc(value) : null;
          const selected = lastLabel === percent.label;
          return (
            <button
              key={percent.label}
              type="button"
              onClick={() => select(percent.label)}
              disabled={!valid}
              title={percent.title}
              className={cn(
                "flex min-h-12 touch-manipulation items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-all disabled:opacity-40",
                percent.primary
                  ? "bg-ocean-teal text-ocean-deep hover:brightness-105"
                  : "border border-ocean-mid/80 bg-ocean-surface text-ocean-foam hover:bg-ocean-mid/40",
                selected && "ring-2 ring-ocean-teal",
              )}
            >
              <span className="text-sm font-bold">{percent.label}</span>
              <span
                className={cn(
                  "text-lg font-bold tabular-nums leading-none",
                  percent.primary ? "text-ocean-deep" : "text-ocean-teal",
                )}
              >
                {result != null ? formatCalcResult(result) : "—"}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "rounded-lg border-2 px-3 py-3 text-center",
          valid
            ? "border-ocean-danger-border bg-ocean-danger-muted"
            : "border-ocean-danger-border/30 bg-ocean-danger-muted/50 opacity-70",
        )}
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-ocean-danger">Risk</p>
        <p className="mt-0.5 text-[10px] text-ocean-danger/80">× 0.80</p>
        <p
          className={cn(
            "mt-1 text-2xl font-bold tabular-nums leading-tight",
            valid ? "text-ocean-danger" : "text-ocean-danger/50",
          )}
        >
          {valid && rRisk != null ? formatCalcResult(rRisk) : "—"}
        </p>
      </div>

      {!valid && input.length > 0 && (
        <p className="text-center text-[11px] text-ocean-sand/60">Enter a valid number</p>
      )}
    </div>
  );
}
