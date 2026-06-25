import { useState, useTransition } from "react";
import { formatCalcResult } from "@/shared/lib/price-calc";
import { formatMinMaxLabel, formatRangoOptimoLabel } from "@/shared/lib/rango-optimo-display";
import { getRangoOptimoAnalysisDate, lookupRangoOptimo } from "./api";

type LookupState = {
  symbol: string;
  rangoLabel: string;
  minMaxLabel: string | null;
  priceOptimo: number | null;
};

export function RangoOptimoLookup() {
  const [symbol, setSymbol] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupState | null>(null);
  const [analysisDate, setAnalysisDate] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onLookup() {
    const trimmed = symbol.trim();
    if (!trimmed) {
      setError("Enter a ticker.");
      setResult(null);
      return;
    }

    setError(null);
    startTransition(async () => {
      const [response, date] = await Promise.all([
        lookupRangoOptimo(trimmed),
        getRangoOptimoAnalysisDate(),
      ]);
      setAnalysisDate(date);

      if (!response.success) {
        setResult(null);
        setError(response.error ?? "Not found.");
        return;
      }

      setResult({
        symbol: response.symbol ?? trimmed.toUpperCase(),
        rangoLabel: formatRangoOptimoLabel({
          rangoOptimoLow: response.rangoOptimoLow ?? null,
          rangoOptimoHigh: response.rangoOptimoHigh ?? null,
          priceOptimo: response.priceOptimo ?? null,
        }),
        minMaxLabel: formatMinMaxLabel({
          minPrice: response.minPrice ?? null,
          maxPrice: response.maxPrice ?? null,
        }),
        priceOptimo: response.priceOptimo ?? null,
      });
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") onLookup();
          }}
          placeholder="NVDA"
          aria-label="Ticker for optimal range"
          className="min-w-0 flex-1 rounded-lg border border-ocean-mid/60 bg-ocean-deep px-3 py-2.5 text-base font-medium uppercase text-ocean-foam placeholder:text-ocean-sand/50 focus:border-ocean-teal focus:outline-none focus:ring-2 focus:ring-ocean-teal/30"
        />
        <button
          type="button"
          onClick={onLookup}
          disabled={pending}
          className="shrink-0 rounded-lg bg-ocean-teal px-3 py-2 text-sm font-bold text-ocean-deep transition-all hover:brightness-105 disabled:opacity-40"
        >
          {pending ? "…" : "Go"}
        </button>
      </div>

      {analysisDate && (
        <p className="text-center text-[10px] text-ocean-sand/50">Data as of {analysisDate}</p>
      )}

      {error && <p className="text-center text-[11px] text-ocean-danger">{error}</p>}

      {result && (
        <div className="space-y-2">
          <p className="text-center text-sm font-bold text-ocean-teal">{result.symbol}</p>
          <div className="rounded-lg bg-ocean-teal/20 px-2 py-2.5 text-center ring-2 ring-ocean-teal">
            <p className="text-[9px] font-bold uppercase tracking-wide text-ocean-sand">
              Optimal range
            </p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-ocean-teal">
              {result.rangoLabel}
            </p>
          </div>
          {result.minMaxLabel ? (
            <div className="rounded-lg bg-ocean-surface/80 px-2 py-2 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wide text-ocean-sand">
                Min / Max
              </p>
              <p className="mt-0.5 text-xs font-semibold tabular-nums text-ocean-foam">
                {result.minMaxLabel}
              </p>
            </div>
          ) : null}
          {result.priceOptimo != null ? (
            <p className="text-center text-[11px] text-ocean-sand/70">
              Midpoint: {formatCalcResult(result.priceOptimo)}
            </p>
          ) : null}
        </div>
      )}

      {!result && !error && (
        <p className="text-center text-[11px] text-ocean-sand/50">Ticker → strike range</p>
      )}
    </div>
  );
}
