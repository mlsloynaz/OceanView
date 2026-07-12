import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  createTicker,
  getTickersCatalog,
  patchTickerActive,
  patchTickersActive,
} from "../api/tickers-client";
import type { AddTickerFormValues } from "../AddTickerForm";
import {
  paginate,
  sortTickersAlphabetically,
  TICKERS_PAGE_SIZE,
  totalPages as calcTotalPages,
} from "../pagination";
import { filterTickersBySearch } from "../search";
import type { CatalogTicker, TickerCatalogFilter } from "../types";

const SEARCH_SUGGESTION_LIMIT = 8;

export function useTickersPane(open: boolean) {
  const [tickers, setTickers] = useState<CatalogTicker[]>([]);
  const [filter, setFilter] = useState<TickerCatalogFilter>("all");
  const [search, setSearchState] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);

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

  const setSearch = useCallback((next: string) => {
    setSearchState(next);
    setPage(1);
  }, []);

  const selectSearchTicker = useCallback((symbol: string) => {
    setSearchState(symbol);
    setPage(1);
  }, []);

  const filteredTickers = useMemo(() => {
    const rows =
      filter === "active"
        ? tickers.filter((row) => row.active)
        : filter === "inactive"
          ? tickers.filter((row) => !row.active)
          : tickers;
    return filterTickersBySearch(sortTickersAlphabetically(rows), search);
  }, [tickers, filter, search]);

  const searchSuggestions = useMemo(() => {
    const q = search.trim();
    if (!q) return [];
    const pool =
      filter === "active"
        ? tickers.filter((row) => row.active)
        : filter === "inactive"
          ? tickers.filter((row) => !row.active)
          : tickers;
    return filterTickersBySearch(pool, q).slice(0, SEARCH_SUGGESTION_LIMIT);
  }, [tickers, filter, search]);

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

  const addTicker = useCallback(async (values: AddTickerFormValues): Promise<boolean> => {
    setMessage(null);
    setError(null);
    setAdding(true);
    try {
      const created = await createTicker({
        symbol: values.symbol,
        name: values.name || null,
        active: values.active,
        isFavorite: values.isFavorite,
      });
      setTickers((prev) => sortTickersAlphabetically([...prev, created]));
      setSearchState(created.symbol);
      setPage(1);
      setFilter("all");
      setMessage(`${created.symbol} added to the catalog.`);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add ticker.");
      return false;
    } finally {
      setAdding(false);
    }
  }, []);

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

  const pageActiveState = useMemo((): "all" | "none" | "mixed" => {
    if (pageTickers.length === 0) return "none";
    if (pageCounts.active === pageTickers.length) return "all";
    if (pageCounts.active === 0) return "none";
    return "mixed";
  }, [pageCounts.active, pageTickers.length]);

  const bulkSetActive = useCallback(
    (nextActive: boolean, scope: "page" | "all") => {
      const source = scope === "page" ? pageTickers : tickers;
      const targets = source.filter((row) => row.active !== nextActive);
      if (targets.length === 0) {
        setMessage(
          nextActive
            ? scope === "page"
              ? "All tickers on this page are already active."
              : "All tickers are already active."
            : scope === "page"
              ? "No active tickers on this page."
              : "No active tickers in the catalog.",
        );
        return;
      }

      if (!nextActive) {
        const ok = window.confirm(
          scope === "page"
            ? `Deactivate ${targets.length} ticker(s) on this page? They will be excluded from Market Assess and Candles bulk actions.`
            : `Deactivate all ${targets.length} active ticker(s)? They will be excluded from Market Assess and Candles bulk actions.`,
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
              ? scope === "page"
                ? `Activated ${updated.length} ticker(s) on this page.`
                : `Activated ${updated.length} ticker(s) across the catalog.`
              : scope === "page"
                ? `Deactivated ${updated.length} ticker(s) on this page.`
                : `Deactivated ${updated.length} ticker(s) across the catalog.`,
          );
        } catch (err) {
          setError(err instanceof Error ? err.message : "Bulk update failed.");
          await loadCatalog();
        } finally {
          setPending({});
        }
      });
    },
    [loadCatalog, pageTickers, tickers],
  );

  const setPageActive = useCallback(
    (nextActive: boolean) => bulkSetActive(nextActive, "page"),
    [bulkSetActive],
  );

  const activatePage = useCallback(() => setPageActive(true), [setPageActive]);
  const deactivatePage = useCallback(() => setPageActive(false), [setPageActive]);
  const activateAll = useCallback(() => bulkSetActive(true, "all"), [bulkSetActive]);
  const deactivateAll = useCallback(() => bulkSetActive(false, "all"), [bulkSetActive]);

  return {
    pageTickers,
    page,
    pages,
    pageSize: TICKERS_PAGE_SIZE,
    filteredCount: filteredTickers.length,
    search,
    searchSuggestions,
    setSearch,
    selectSearchTicker,
    setPage,
    filter,
    setFilter: setFilterAndResetPage,
    counts,
    pageCounts,
    pageActiveState,
    loading,
    error,
    message,
    pending,
    isPending,
    adding,
    reload: loadCatalog,
    addTicker,
    setActive,
    activatePage,
    deactivatePage,
    activateAll,
    deactivateAll,
  };
}
