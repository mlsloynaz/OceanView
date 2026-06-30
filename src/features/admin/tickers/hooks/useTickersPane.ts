import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { getTickersCatalog, patchTickerActive, patchTickersActive } from "../api/tickers-client";
import {
  paginate,
  sortTickersAlphabetically,
  TICKERS_PAGE_SIZE,
  totalPages as calcTotalPages,
} from "../pagination";
import type { CatalogTicker, TickerCatalogFilter } from "../types";

export function useTickersPane(open: boolean) {
  const [tickers, setTickers] = useState<CatalogTicker[]>([]);
  const [filter, setFilter] = useState<TickerCatalogFilter>("all");
  const [page, setPage] = useState(1);
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
      setTickers(sortTickersAlphabetically(rows));
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

  const setFilterAndResetPage = useCallback((next: TickerCatalogFilter) => {
    setFilter(next);
    setPage(1);
  }, []);

  const filteredTickers = useMemo(() => {
    const rows =
      filter === "active"
        ? tickers.filter((row) => row.active)
        : filter === "inactive"
          ? tickers.filter((row) => !row.active)
          : tickers;
    return sortTickersAlphabetically(rows);
  }, [tickers, filter]);

  const pages = useMemo(
    () => calcTotalPages(filteredTickers.length, TICKERS_PAGE_SIZE),
    [filteredTickers.length],
  );

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const pageTickers = useMemo(
    () => paginate(filteredTickers, page, TICKERS_PAGE_SIZE),
    [filteredTickers, page],
  );

  const pageCounts = useMemo(
    () => ({
      inactive: pageTickers.filter((row) => !row.active).length,
      active: pageTickers.filter((row) => row.active).length,
    }),
    [pageTickers],
  );

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
          sortTickersAlphabetically(
            prev.map((row) => (row.symbol === updated.symbol ? updated : row)),
          ),
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

  const setPageActive = useCallback(
    (nextActive: boolean) => {
      const targets = pageTickers.filter((row) => row.active !== nextActive);
      if (targets.length === 0) {
        setMessage(
          nextActive
            ? "All tickers on this page are already active."
            : "No active tickers on this page.",
        );
        return;
      }

      if (!nextActive) {
        const ok = window.confirm(
          `Deactivate ${targets.length} ticker(s) on this page? They will be excluded from Market Assess and Candles bulk actions.`,
        );
        if (!ok) return;
      }

      setMessage(null);
      setError(null);
      const pendingKeys = Object.fromEntries(targets.map((row) => [row.symbol, true]));
      setPending((prev) => ({ ...prev, ...pendingKeys }));

      startTransition(async () => {
        try {
          const updated = await patchTickersActive(
            targets.map((row) => row.symbol),
            nextActive,
          );
          const bySymbol = new Map(updated.map((row) => [row.symbol, row]));
          setTickers((prev) =>
            sortTickersAlphabetically(
              prev.map((row) => bySymbol.get(row.symbol) ?? row),
            ),
          );
          setMessage(
            nextActive
              ? `Activated ${updated.length} ticker(s) on this page.`
              : `Deactivated ${updated.length} ticker(s) on this page.`,
          );
        } catch (err) {
          setError(err instanceof Error ? err.message : "Bulk update failed.");
          await loadCatalog();
        } finally {
          setPending({});
        }
      });
    },
    [pageTickers, loadCatalog],
  );

  const activatePage = useCallback(() => setPageActive(true), [setPageActive]);
  const deactivatePage = useCallback(() => setPageActive(false), [setPageActive]);

  return {
    pageTickers,
    page,
    pages,
    pageSize: TICKERS_PAGE_SIZE,
    filteredCount: filteredTickers.length,
    setPage,
    filter,
    setFilter: setFilterAndResetPage,
    counts,
    pageCounts,
    loading,
    error,
    message,
    pending,
    isPending,
    reload: loadCatalog,
    setActive,
    activatePage,
    deactivatePage,
  };
}
