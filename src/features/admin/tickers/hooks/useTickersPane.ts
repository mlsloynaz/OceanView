import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { getTickersCatalog, patchTickerActive } from "../api/tickers-client";
import type { CatalogTicker, TickerCatalogFilter } from "../types";

export function useTickersPane(open: boolean) {
  const [tickers, setTickers] = useState<CatalogTicker[]>([]);
  const [filter, setFilter] = useState<TickerCatalogFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  const loadCatalog = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { tickers: rows } = await getTickersCatalog();
      setTickers(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ticker catalog.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadCatalog();
  }, [open, loadCatalog]);

  const filteredTickers = useMemo(() => {
    switch (filter) {
      case "active":
        return tickers.filter((row) => row.active);
      case "inactive":
        return tickers.filter((row) => !row.active);
      default:
        return tickers;
    }
  }, [tickers, filter]);

  const counts = useMemo(
    () => ({
      total: tickers.length,
      active: tickers.filter((row) => row.active).length,
      inactive: tickers.filter((row) => !row.active).length,
    }),
    [tickers],
  );

  const setActive = useCallback((symbol: string, nextActive: boolean) => {
    const upper = symbol.toUpperCase();
    if (!nextActive) {
      const ok = window.confirm(
        `${upper} will be excluded from Market Assess and default Candles bulk actions. Continue?`,
      );
      if (!ok) return;
    }

    setMessage(null);
    setError(null);
    setPending((prev) => ({ ...prev, [upper]: true }));

    startTransition(async () => {
      try {
        const updated = await patchTickerActive(upper, nextActive);
        setTickers((prev) =>
          prev.map((row) => (row.symbol === updated.symbol ? updated : row)),
        );
        setMessage(
          nextActive
            ? `${updated.symbol} is active for Market and Candles.`
            : `${updated.symbol} deactivated.`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update ticker.");
      } finally {
        setPending((prev) => {
          const next = { ...prev };
          delete next[upper];
          return next;
        });
      }
    });
  }, []);

  return {
    tickers: filteredTickers,
    filter,
    setFilter,
    counts,
    loading,
    error,
    message,
    pending,
    isPending,
    reload: loadCatalog,
    setActive,
  };
}
