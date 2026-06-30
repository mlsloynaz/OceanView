import { useEffect, useState, useTransition } from "react";
import { formatCalcResult } from "@/shared/lib/price-calc";
import { formatMinMaxLabel, formatRangoOptimoLabel } from "@/shared/lib/rango-optimo-display";
import { getRangoOptimoMeta, lookupRangoOptimo } from "./api";

type LookupState = {
  symbol: string;
  nombre: string | null;
  rangoLabel: string;
  minMaxLabel: string | null;
  priceOptimo: number | null;
};

export function RangoOptimoLookup() {
  const [symbol, setSymbol] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupState | null>(null);
  const [analysisDate, setAnalysisDate] = useState<string | null>(null);
  const [catalogCount, setCatalogCount] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void getRangoOptimoMeta()
      .then((meta) => {
        setAnalysisDate(meta.analysisDate);
        setCatalogCount(meta.count);
      })
      .catch(() => {
        setCatalogCount(null);
      });
  }, []);

  function onLookup() {
    const trimmed = symbol.trim();
    if (!trimmed) {
      setError("Enter a ticker.");
      setResult(null);
      return;
    }

    setError(null);
    startTransition(async () => {
      const [response, meta] = await Promise.all([
        lookupRangoOptimo(trimmed),
        getRangoOptimoMeta(),
      ]);
      setAnalysisDate(meta.analysisDate);
      setCatalogCount(meta.count);

      if (!response.success) {
        setResult(null);
        setError(response.error ?? "Not found.");
        return;
      }

      setResult({
        symbol: response.symbol ?? trimmed.toUpperCase(),
        nombre: response.nombre ?? null,
        rangoLabel: formatRangoOptimoLabel({
          rangoOptimoLow: response.rangoOptimoLow ?? response.rangeLow ?? null,
          rangoOptimoHigh: response.rangoOptimoHigh ?? response.rangeHigh ?? null,
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
          placeholder="AMD"
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

      {catalogCount != null && catalogCount > 0 && (
        <p className="text-center text-[10px] text-ocean-sand/50">
          {catalogCount} symbols
          {analysisDate ? ` · data as of ${analysisDate}` : ""}
        </p>
      )}

      {catalogCount === 0 && (
        <p className="text-center text-[11px] text-ocean-danger">
          Catalog empty — run npm run import:rango-optimo on your Excel file.
        </p>
      )}

      {error && <p className="text-center text-[11px] text-ocean-danger">{error}</p>}

      {result && (
        <div className="space-y-2">
          <p className="text-center text-sm font-bold text-ocean-teal">{result.symbol}</p>
          {result.nombre && (
            <p className="text-center text-[11px] text-ocean-sand">{result.nombre}</p>
          )}
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
