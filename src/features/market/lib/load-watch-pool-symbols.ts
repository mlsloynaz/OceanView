/**
 * Resolve SemiFinal watch-pool symbols for Market Assess (RTH confirm / narrow discovery).
 */
import { getSetupScanResult } from "@/features/admin/setup-scan/api/preselection-client";
import type { PreselectionResultResponse } from "@/features/admin/setup-scan/types";

function symbolsFromWatchPool(payload: PreselectionResultResponse): string[] {
  const raw = payload.watchPool?.symbols;
  if (Array.isArray(raw) && raw.length > 0) {
    return [
      ...new Set(
        raw
          .map((s) => String(s || "").trim().toUpperCase())
          .filter(Boolean),
      ),
    ].sort();
  }
  const seen = new Set<string>();
  for (const group of payload.strategies ?? []) {
    for (const row of group.tickers ?? []) {
      if (row.requiredPassed === false) continue;
      const sym = String(row.symbol || "").trim().toUpperCase();
      if (sym) seen.add(sym);
    }
  }
  return [...seen].sort();
}

/** Prefer open SemiFinal pool, then EOD. */
export async function loadMarketWatchPoolSymbols(): Promise<string[]> {
  for (const mode of ["open", "eod"] as const) {
    try {
      const payload = await getSetupScanResult(undefined, mode);
      const symbols = symbolsFromWatchPool(payload);
      if (symbols.length > 0) return symbols;
    } catch {
      /* try next mode */
    }
  }
  return [];
}
