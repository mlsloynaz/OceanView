import { useState } from "react";
import {
  calc10,
  calc20,
  calc35,
  calcRisk,
  formatCalcResult,
} from "@/shared/lib/price-calc";
import { cn } from "@/shared/lib/cn";

export function PriceCalc() {
  const [input, setInput] = useState("");
  const [lastLabel, setLastLabel] = useState<string | null>(null);

  const value = parseFloat(input);
  const valid = Number.isFinite(value);
  const r35 = valid ? calc35(value) : null;
  const r20 = valid ? calc20(value) : null;
  const r10 = valid ? calc10(value) : null;
  const rRisk = valid ? calcRisk(value) : null;
  const lastIs35 = lastLabel === "35%";
  const lastIs20 = lastLabel === "20%";
  const lastIs10 = lastLabel === "10%";

  function run35() {
    if (!valid) return;
    setLastLabel("35%");
  }

  function run20() {
    if (!valid) return;
    setLastLabel("20%");
  }

  function run10() {
    if (!valid) return;
    setLastLabel("10%");
  }

  return (
    <div className="space-y-3">
      <input
        type="number"
        step="any"
        inputMode="decimal"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="0.00"
        aria-label="Amount to calculate"
        className="w-full rounded-lg border border-ocean-mid/60 bg-ocean-deep px-3 py-2.5 text-base font-medium text-ocean-foam placeholder:text-ocean-sand/50 focus:border-ocean-teal focus:outline-none focus:ring-2 focus:ring-ocean-teal/30"
      />

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={run35}
          disabled={!valid}
          className="rounded-lg bg-ocean-teal px-2 py-2 text-sm font-bold text-ocean-deep transition-all hover:brightness-105 disabled:opacity-40"
          title="× 1.35 + 0.02"
        >
          35%
        </button>
        <button
          type="button"
          onClick={run20}
          disabled={!valid}
          className="rounded-lg border border-ocean-mid/80 bg-ocean-surface px-2 py-2 text-sm font-bold text-ocean-foam transition-all hover:bg-ocean-mid/40 disabled:opacity-40"
          title="× 1.2 + 0.02"
        >
          20%
        </button>
        <button
          type="button"
          onClick={run10}
          disabled={!valid}
          className="rounded-lg border border-ocean-mid/80 bg-ocean-surface px-2 py-2 text-sm font-bold text-ocean-foam transition-all hover:bg-ocean-mid/40 disabled:opacity-40"
          title="× 1.1 + 0.02"
        >
          10%
        </button>
      </div>

      {valid && r35 != null && r20 != null && r10 != null && (
        <div className="grid grid-cols-3 gap-2">
          <div
            className={cn(
              "rounded-lg px-2 py-2.5 text-center",
              lastIs35 ? "bg-ocean-teal/20 ring-2 ring-ocean-teal" : "bg-ocean-surface/80",
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ocean-sand">35%</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums leading-tight text-ocean-teal">
              {formatCalcResult(r35)}
            </p>
          </div>
          <div
            className={cn(
              "rounded-lg px-2 py-2.5 text-center",
              lastIs20 ? "bg-ocean-teal/20 ring-2 ring-ocean-teal" : "bg-ocean-surface/80",
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ocean-sand">20%</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums leading-tight text-ocean-teal">
              {formatCalcResult(r20)}
            </p>
          </div>
          <div
            className={cn(
              "rounded-lg px-2 py-2.5 text-center",
              lastIs10 ? "bg-ocean-teal/20 ring-2 ring-ocean-teal" : "bg-ocean-surface/80",
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ocean-sand">10%</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums leading-tight text-ocean-teal">
              {formatCalcResult(r10)}
            </p>
          </div>
        </div>
      )}

      <div
        className={cn(
          "rounded-lg border-2 px-2 py-3 text-center",
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
