import { calc35, calcRisk } from "@/shared/lib/price-calc";
import { formatSymbol } from "@/shared/lib/format-symbol";
import type { RangoOptimoEntry, RangoOptimoFile, RangoOptimoLookupResult } from "./types";

const DATA_URL = "/data/rango-optimo.json";

let cache: Map<string, RangoOptimoEntry> | null = null;
let analysisDate: string | null = null;
let catalogCount = 0;

async function loadIndex(): Promise<Map<string, RangoOptimoEntry>> {
  if (cache) return cache;

  const response = await fetch(DATA_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load ${DATA_URL} (${response.status})`);
  }

  const file = (await response.json()) as RangoOptimoFile;
  analysisDate = file.analysisDate ?? null;
  catalogCount = file.entries?.length ?? 0;

  cache = new Map(
    (file.entries ?? []).map((entry) => [formatSymbol(entry.symbol), entry]),
  );

  return cache;
}

export async function getRangoOptimoMeta(): Promise<{
  analysisDate: string | null;
  count: number;
}> {
  await loadIndex();
  return { analysisDate, count: catalogCount };
}

export async function getRangoOptimoAnalysisDate(): Promise<string | null> {
  const meta = await getRangoOptimoMeta();
  return meta.analysisDate;
}

function entryToResult(symbol: string, entry: RangoOptimoEntry): RangoOptimoLookupResult {
  const priceOptimo = entry.priceOptimo ?? null;
  const rangoOptimoLow = entry.rangoOptimoLow ?? null;
  const rangoOptimoHigh = entry.rangoOptimoHigh ?? null;
  const rangeLow = rangoOptimoLow ?? (priceOptimo != null ? calcRisk(priceOptimo) : null);
  const rangeHigh = rangoOptimoHigh ?? (priceOptimo != null ? calc35(priceOptimo) : null);

  return {
    success: true,
    symbol,
    nombre: entry.nombre ?? null,
    priceOptimo,
    rangoOptimoLow,
    rangoOptimoHigh,
    minPrice: entry.minPrice ?? null,
    maxPrice: entry.maxPrice ?? null,
    rangeLow,
    rangeHigh,
  };
}

export async function lookupRangoOptimo(symbol: string): Promise<RangoOptimoLookupResult> {
  const normalized = formatSymbol(symbol);
  if (!normalized) {
    return { success: false, error: "Enter a valid ticker." };
  }

  try {
    const index = await loadIndex();
    const entry = index.get(normalized);

    if (!entry) {
      return {
        success: false,
        error: `No optimal range for ${normalized}. (${catalogCount} symbols in catalog.)`,
      };
    }

    return entryToResult(normalized, entry);
  } catch {
    return {
      success: false,
      error: "Could not read data/rango-optimo.json",
    };
  }
}

/** Call after editing the JSON file to pick up changes without reloading the page. */
export function clearRangoOptimoCache(): void {
  cache = null;
  analysisDate = null;
  catalogCount = 0;
}
