import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  createTicker,
  deleteTicker,
  fetchMovementProfilesForSymbols,
  getBestFitWatchlist,
  getTickersCatalog,
  getTradableWatchlist,
  patchTickerActive,
  patchTickerName,
  patchTickersActive,
  patchAllTickersActive,
  postTradableOceanDeskExport,
  refineTradableWatchlist,
  resolveBestFitWatchlist,
  resetTradabilitySamples,
  stopTradableCollect,
} from "../api/tickers-client";
import type { AddTickerFormValues } from "../AddTickerForm";
import {
  paginate,
  sortTickersAlphabetically,
  TICKERS_PAGE_SIZE,
  totalPages as calcTotalPages,
} from "../pagination";
import { filterTickersBySearch } from "../search";
import type {
  BestFitWatchlistResponse,
  CatalogTicker,
  TickerCatalogFilter,
  TickerMovementProfileEntry,
  TradableWatchlistResponse,
} from "../types";

const SEARCH_SUGGESTION_LIMIT = 8;

export type ProfileCacheEntry =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; entry: TickerMovementProfileEntry };

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
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [profileCache, setProfileCache] = useState<Record<string, ProfileCacheEntry>>({});
  const profileCacheRef = useRef(profileCache);
  profileCacheRef.current = profileCache;
  const [bestFit, setBestFit] = useState<BestFitWatchlistResponse | null>(null);
  const [bestFitLoading, setBestFitLoading] = useState(false);
  const [bestFitResolving, setBestFitResolving] = useState(false);
  const [bestFitError, setBestFitError] = useState<string | null>(null);
  const [tradable, setTradable] = useState<TradableWatchlistResponse | null>(null);
  const [tradableLoading, setTradableLoading] = useState(false);
  const [tradableRefining, setTradableRefining] = useState(false);
  const [tradableError, setTradableError] = useState<string | null>(null);

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

  const loadBestFit = useCallback(async () => {
    setBestFitError(null);
    setBestFitLoading(true);
    try {
      const payload = await getBestFitWatchlist();
      setBestFit(payload);
    } catch (err) {
      setBestFitError(err instanceof Error ? err.message : "Failed to load best-fit watchlist.");
    } finally {
      setBestFitLoading(false);
    }
  }, []);

  const resolveBestFit = useCallback(async () => {
    setBestFitError(null);
    setBestFitResolving(true);
    try {
      const payload = await resolveBestFitWatchlist({
        limit: 10,
        activateTop: false,
      });
      setBestFit(payload);
      setMessage(payload.message ?? "Best-fit ranking resolved.");
    } catch (err) {
      setBestFitError(err instanceof Error ? err.message : "Failed to resolve best-fit ranking.");
    } finally {
      setBestFitResolving(false);
    }
  }, []);

  const loadTradable = useCallback(async () => {
    setTradableError(null);
    setTradableLoading(true);
    try {
      const payload = await getTradableWatchlist();
      setTradable(payload);
    } catch (err) {
      setTradableError(err instanceof Error ? err.message : "Failed to load tradable watchlist.");
    } finally {
      setTradableLoading(false);
    }
  }, []);

  const tradableCollecting = useMemo(() => {
    const status = String(tradable?.status || "").toLowerCase();
    return status === "running" || status === "stopping";
  }, [tradable?.status]);

  // Poll GET on the same cadence as async batches (default 30s) while collecting.
  useEffect(() => {
    if (!open || !tradableCollecting) return;
    const pollMs = Math.max(5, Number(tradable?.pollIntervalSeconds) || 30) * 1000;
    const id = window.setInterval(() => {
      void getTradableWatchlist()
        .then((payload) => {
          setTradable(payload);
          const status = String(payload.status || "").toLowerCase();
          if (status !== "running" && status !== "stopping") {
            setMessage(payload.message ?? "Tradable collect finished.");
            setTradableRefining(false);
          }
        })
        .catch((err) => {
          setTradableError(
            err instanceof Error ? err.message : "Failed to poll tradable watchlist.",
          );
        });
    }, pollMs);
    return () => window.clearInterval(id);
  }, [open, tradableCollecting, tradable?.pollIntervalSeconds]);

  const refineTradable = useCallback(async (opts?: { force?: boolean }) => {
    setTradableError(null);
    setTradableRefining(true);
    try {
      const payload = await refineTradableWatchlist({
        limit: 5,
        activateTop: false,
        force: Boolean(opts?.force),
      });
      setTradable(payload);
      setMessage(payload.message ?? "Tradable collect started — polling every 30s.");
      const status = String(payload.status || "").toLowerCase();
      if (status !== "running" && status !== "stopping") {
        setTradableRefining(false);
      }
    } catch (err) {
      setTradableRefining(false);
      setTradableError(err instanceof Error ? err.message : "Failed to collect tradability samples.");
    }
  }, []);

  const stopTradable = useCallback(async () => {
    setTradableError(null);
    try {
      const ack = await stopTradableCollect();
      setMessage(ack.message ?? "Stop requested.");
      const payload = await getTradableWatchlist();
      setTradable(payload);
    } catch (err) {
      setTradableError(err instanceof Error ? err.message : "Failed to stop tradable collect.");
    }
  }, []);

  const [resettingTradable, setResettingTradable] = useState(false);

  const resetTradableSamples = useCallback(async () => {
    setTradableError(null);
    setResettingTradable(true);
    try {
      const ack = await resetTradabilitySamples();
      setMessage(ack.message ?? "Tradability samples cleared.");
      const [tradablePayload, catalog] = await Promise.all([
        getTradableWatchlist(),
        getTickersCatalog(),
      ]);
      setTradable(tradablePayload);
      setTickers(catalog.tickers ?? []);
    } catch (err) {
      setTradableError(
        err instanceof Error ? err.message : "Failed to clear tradability samples.",
      );
    } finally {
      setResettingTradable(false);
    }
  }, []);

  const [exportingDesk, setExportingDesk] = useState(false);

  const downloadOceanDeskJson = useCallback(async () => {
    setTradableError(null);
    setExportingDesk(true);
    try {
      const symbols =
        tradable?.sourceSymbols?.length
          ? tradable.sourceSymbols
          : tickers.map((row) => row.symbol.trim().toUpperCase()).filter(Boolean);
      const payload = await postTradableOceanDeskExport(
        symbols.length ? { tickers: symbols } : undefined,
      );
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const day = String(payload.updatedAt || "").slice(0, 10) || "export";
      a.href = url;
      a.download = `stop_metrics_${day}.json`;
      a.click();
      URL.revokeObjectURL(url);
      const miss = payload.missing?.length ?? 0;
      setMessage(
        `Downloaded OceanDesk JSON · ${payload.tickerCount} ticker(s)` +
          (miss ? ` · ${miss} missing` : "") +
          ` — save as stop_metrics.json`,
      );
    } catch (err) {
      setTradableError(err instanceof Error ? err.message : "OceanDesk export failed.");
    } finally {
      setExportingDesk(false);
    }
  }, [tickers, tradable?.sourceSymbols]);

  useEffect(() => {
    if (!open) return;
    void loadBestFit();
    void loadTradable();
  }, [open, loadBestFit, loadTradable]);

  const setFilterAndResetPage = useCallback((next: TickerCatalogFilter) => {
    setFilter(next);
    setPage(1);
    setExpandedSymbol(null);
  }, []);

  const setSearch = useCallback((next: string) => {
    setSearchState(next);
    setPage(1);
    setExpandedSymbol(null);
  }, []);

  const selectSearchTicker = useCallback((symbol: string) => {
    setSearchState(symbol);
    setPage(1);
    setExpandedSymbol(null);
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

  const setPageAndCollapse = useCallback((next: number) => {
    setPage(next);
    setExpandedSymbol(null);
  }, []);

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

  const loadMovementProfile = useCallback(async (symbol: string) => {
    const upper = symbol.toUpperCase();
    const existing = profileCacheRef.current[upper];
    if (existing?.status === "loading" || existing?.status === "ready") return;

    setProfileCache((prev) => ({ ...prev, [upper]: { status: "loading" } }));
    try {
      const rows = await fetchMovementProfilesForSymbols([upper]);
      const entry = rows[0] ?? {
        symbol: upper,
        outcome: "unknown",
        message: "No stored movement profile yet",
        profile: null,
      };
      setProfileCache((prev) => ({ ...prev, [upper]: { status: "ready", entry } }));
    } catch (err) {
      setProfileCache((prev) => ({
        ...prev,
        [upper]: {
          status: "error",
          error: err instanceof Error ? err.message : "Failed to load movement profile.",
        },
      }));
    }
  }, []);

  const toggleExpanded = useCallback(
    (symbol: string) => {
      const upper = symbol.toUpperCase();
      setExpandedSymbol((prev) => {
        const next = prev === upper ? null : upper;
        if (next) void loadMovementProfile(next);
        return next;
      });
    },
    [loadMovementProfile],
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

  const renameTicker = useCallback(async (symbol: string, name: string): Promise<boolean> => {
    const upper = symbol.toUpperCase();
    const cleaned = name.trim();
    setMessage(null);
    setError(null);
    setPending((prev) => ({ ...prev, [upper]: true }));
    try {
      const updated = await patchTickerName(upper, cleaned || null);
      setTickers((prev) =>
        sortTickersAlphabetically(
          prev.map((row) => (row.symbol === updated.symbol ? updated : row)),
        ),
      );
      setMessage(
        updated.name
          ? `${updated.symbol} renamed to “${updated.name}”.`
          : `${updated.symbol} name cleared.`,
      );
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update ticker name.");
      return false;
    } finally {
      setPending((prev) => {
        const next = { ...prev };
        delete next[upper];
        return next;
      });
    }
  }, []);

  const removeTicker = useCallback(async (symbol: string): Promise<boolean> => {
    const upper = symbol.toUpperCase();
    const ok = window.confirm(
      `Delete ${upper} from the catalog?\n\nThis removes it from Watchlist / Market / Premarket. Related movement and tradability profiles are deleted too.`,
    );
    if (!ok) return false;

    setMessage(null);
    setError(null);
    setPending((prev) => ({ ...prev, [upper]: true }));
    try {
      await deleteTicker(upper);
      setTickers((prev) => prev.filter((row) => row.symbol.toUpperCase() !== upper));
      setExpandedSymbol((prev) => (prev === upper ? null : prev));
      setProfileCache((prev) => {
        if (!(upper in prev)) return prev;
        const next = { ...prev };
        delete next[upper];
        return next;
      });
      setMessage(`${upper} deleted from the catalog.`);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete ticker.");
      return false;
    } finally {
      setPending((prev) => {
        const next = { ...prev };
        delete next[upper];
        return next;
      });
    }
  }, []);

  const pageActiveState = useMemo((): "all" | "none" | "mixed" => {
    if (pageTickers.length === 0) return "none";
    if (pageCounts.active === pageTickers.length) return "all";
    if (pageCounts.active === 0) return "none";
    return "mixed";
  }, [pageCounts.active, pageTickers.length]);

  const bulkSetActive = useCallback(
    (nextActive: boolean, scope: "page" | "all") => {
      if (scope === "all") {
        const total = tickers.length;
        if (total === 0) {
          setMessage("Catalog is empty.");
          return;
        }
        const already = tickers.filter((row) => row.active === nextActive).length;
        const changing = total - already;
        if (changing === 0) {
          setMessage(
            nextActive
              ? "All tickers are already active."
              : "All tickers are already inactive.",
          );
          return;
        }
        if (!nextActive) {
          const ok = window.confirm(
            `Deactivate all ${total} ticker(s) in the catalog?\n\n${changing} will change; ${already} already inactive.\nThey will be excluded from Market Assess and Candles bulk actions.`,
          );
          if (!ok) return;
        } else {
          const ok = window.confirm(
            `Activate all ${total} ticker(s) in the catalog?\n\n${changing} will change; ${already} already active.`,
          );
          if (!ok) return;
        }
        setMessage(null);
        setError(null);
        startTransition(async () => {
          try {
            const result = await patchAllTickersActive(nextActive);
            // Reload full catalog so every row reflects the new active flag.
            const { tickers: rows } = await getTickersCatalog();
            setTickers(sortTickersAlphabetically(rows));
            setMessage(
              result.message ||
                `${nextActive ? "Activated" : "Deactivated"} ${result.updatedCount} of ${result.totalConsidered} ticker(s).`,
            );
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update tickers.");
          }
        });
        return;
      }

      const source = pageTickers;
      const targets = source.filter((row) => row.active !== nextActive);
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
          `${targets.length} ticker(s) on this page will be excluded from Market Assess and default Candles bulk actions. Continue?`,
        );
        if (!ok) return;
      }

      setMessage(null);
      setError(null);
      startTransition(async () => {
        try {
          const updated = await patchTickersActive(
            targets.map((row) => row.symbol),
            nextActive,
          );
          const bySymbol = new Map(updated.map((row) => [row.symbol, row]));
          setTickers((prev) =>
            sortTickersAlphabetically(
              prev.map((row) => {
                const hit = bySymbol.get(row.symbol);
                return hit ? { ...row, active: hit.active } : row;
              }),
            ),
          );
          setMessage(
            nextActive
              ? `Activated ${updated.length} ticker(s).`
              : `Deactivated ${updated.length} ticker(s).`,
          );
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to update tickers.");
        }
      });
    },
    [pageTickers, tickers],
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
    setPage: setPageAndCollapse,
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
    renameTicker,
    removeTicker,
    activatePage,
    deactivatePage,
    activateAll,
    deactivateAll,
    expandedSymbol,
    toggleExpanded,
    profileCache,
    bestFit,
    bestFitLoading,
    bestFitResolving,
    bestFitError,
    resolveBestFit,
    tradable,
    tradableLoading,
    tradableRefining,
    tradableCollecting,
    tradableError,
    refineTradable,
    stopTradable,
    resettingTradable,
    resetTradableSamples,
    exportingDesk,
    downloadOceanDeskJson,
    tickers,
  };
}
