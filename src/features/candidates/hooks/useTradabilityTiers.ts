import { useCallback, useEffect, useState } from "react";
import { getTradableWatchlist } from "@/features/admin/tickers/api/tickers-client";
import type { TradableWatchlistResponse } from "@/features/admin/tickers/types";

/**
 * Flatten Tradable GET payload into symbol → tier for candidate adapters.
 * Prefer ranked/watchlist tiers; skip → poor; not ready stays absent (Unknown).
 */
export function buildTradabilityBySymbol(
  payload: TradableWatchlistResponse | null | undefined,
): Record<string, string> {
  const map: Record<string, string> = {};
  if (!payload) return map;

  for (const row of payload.watchlist ?? []) {
    const symbol = String(row.symbol || "")
      .trim()
      .toUpperCase();
    const tier = String(row.tier || "")
      .trim()
      .toLowerCase();
    if (symbol && tier) map[symbol] = tier;
  }

  for (const row of payload.skipped ?? []) {
    const symbol = String(row.symbol || "")
      .trim()
      .toUpperCase();
    if (symbol && map[symbol] == null) map[symbol] = "skip";
  }

  return map;
}

export type TradabilityTiersState = {
  bySymbol: Record<string, string>;
  status: string | null;
  readyCount: number;
  sourceCount: number;
  empty: boolean;
  loading: boolean;
  error: string | null;
  message: string | null;
  refresh: () => Promise<void>;
};

/** Load Admin Tradable ranking once for Today / candidate tables. */
export function useTradabilityTiers(): TradabilityTiersState {
  const [bySymbol, setBySymbol] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [readyCount, setReadyCount] = useState(0);
  const [sourceCount, setSourceCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await getTradableWatchlist();
      setBySymbol(buildTradabilityBySymbol(payload));
      setStatus(String(payload.status || "").toLowerCase() || null);
      setReadyCount(Number(payload.readyCount) || 0);
      setSourceCount(Number(payload.sourceCount) || 0);
      setMessage(payload.message ?? null);
    } catch (err) {
      setBySymbol({});
      setStatus(null);
      setReadyCount(0);
      setSourceCount(0);
      setMessage(null);
      setError(err instanceof Error ? err.message : "Failed to load tradability.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const empty =
    !loading &&
    !error &&
    (status === "empty" || (readyCount === 0 && Object.keys(bySymbol).length === 0));

  return {
    bySymbol,
    status,
    readyCount,
    sourceCount,
    empty,
    loading,
    error,
    message,
    refresh,
  };
}
