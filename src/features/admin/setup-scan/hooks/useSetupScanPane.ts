import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { getTickersCatalog, patchTickerActive } from "../../tickers/api/tickers-client";
import {
  getSetupScanResult,
  pollSetupScanResult,
  postSetupScanRun,
  SetupScanApiError,
} from "../api/preselection-client";
import { mergePreselectionWithCatalogActive } from "../merge-catalog-active";
import {
  filterSemiFinalResult,
  semiFinalMatchCount,
  semiFinalSearchSuggestions,
} from "../search";
import type { PreselectionResultResponse, PreselectionTickerRow } from "../types";

export type SetupScanMode = "live" | "simulate";

export function useSetupScanPane(open: boolean) {
  const [result, setResult] = useState<PreselectionResultResponse | null>(null);
  const [minScore, setMinScore] = useState(0);
  const [scanMode, setScanMode] = useState<SetupScanMode>("live");
  const [simulationDate, setSimulationDate] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [runPending, startRunTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tickerPending, setTickerPending] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<{
    strategyName: string;
    ticker: PreselectionTickerRow;
  } | null>(null);

  const loadResult = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [payload, catalog] = await Promise.all([
        getSetupScanResult(),
        getTickersCatalog(),
      ]);
      setResult(mergePreselectionWithCatalogActive(payload, catalog.tickers));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load Tickers SemiFinal result.";
      if (!msg.toLowerCase().includes("not found")) {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadResult();
  }, [open, loadResult]);

  const filteredResult = useMemo(
    () => filterSemiFinalResult(result, search),
    [result, search],
  );

  const searchSuggestions = useMemo(
    () => semiFinalSearchSuggestions(result, search),
    [result, search],
  );

  const searchMatchCount = useMemo(
    () => semiFinalMatchCount(result, search),
    [result, search],
  );

  const selectSearchTicker = useCallback((symbol: string) => {
    setSearch(symbol);
  }, []);

  const applyCatalogActive = useCallback(
    async (payload: PreselectionResultResponse) => {
      const { tickers } = await getTickersCatalog();
      return mergePreselectionWithCatalogActive(payload, tickers);
    },
    [],
  );

  const runScan = useCallback(() => {
    startRunTransition(async () => {
      setError(null);
      setMessage(null);
      if (scanMode === "simulate" && !simulationDate.trim()) {
        setError("Pick a session date for simulation.");
        return;
      }
      try {
        const ack = await postSetupScanRun({
          minScore,
          simulationDate: scanMode === "simulate" ? simulationDate.trim() : undefined,
        });
        const runId = ack.runId;
        if ((ack.status ?? "").toLowerCase() === "complete" && ack.strategies?.length) {
          setResult(await applyCatalogActive(ack));
          setMessage(ack.message ?? "Tickers SemiFinal complete.");
          return;
        }
        setMessage(ack.message ?? "Tickers SemiFinal started…");
        const payload = await pollSetupScanResult(runId, (progress) => {
          const done = progress.progress?.done;
          const total = progress.progress?.total;
          if (done != null && total != null) {
            setMessage(`Scanning… ${done}/${total}`);
          }
        });
        setResult(await applyCatalogActive(payload));
        setMessage(payload.message ?? "Tickers SemiFinal complete.");
      } catch (err) {
        if (err instanceof SetupScanApiError && err.status === 504) {
          setMessage("Request timed out — scan may still be running. Loading result…");
          try {
            const payload = await pollSetupScanResult(undefined, (progress) => {
              const done = progress.progress?.done;
              const total = progress.progress?.total;
              if (done != null && total != null) {
                setMessage(`Scanning… ${done}/${total}`);
              }
            });
            setResult(await applyCatalogActive(payload));
            setMessage(payload.message ?? "Tickers SemiFinal complete.");
            return;
          } catch (pollErr) {
            setError(
              pollErr instanceof Error ? pollErr.message : "Tickers SemiFinal did not finish in time.",
            );
            return;
          }
        }
        setError(err instanceof Error ? err.message : "Tickers SemiFinal failed.");
      }
    });
  }, [applyCatalogActive, minScore, scanMode, simulationDate]);

  const setActive = useCallback(async (symbol: string, active: boolean) => {
    const upper = symbol.trim().toUpperCase();
    setTickerPending((prev) => ({ ...prev, [upper]: true }));
    setError(null);
    try {
      const updated = await patchTickerActive(upper, active);
      setResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          strategies: prev.strategies.map((group) => ({
            ...group,
            tickers: group.tickers.map((row) =>
              row.symbol.toUpperCase() === upper
                ? { ...row, currentlyActive: updated.active }
                : row,
            ),
          })),
        };
      });
      setDetail((prev) =>
        prev && prev.ticker.symbol.toUpperCase() === upper
          ? { ...prev, ticker: { ...prev.ticker, currentlyActive: updated.active } }
          : prev,
      );
      setMessage(`${updated.symbol} ${updated.active ? "activated" : "deactivated"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ticker update failed.");
    } finally {
      setTickerPending((prev) => {
        const next = { ...prev };
        delete next[upper];
        return next;
      });
    }
  }, []);

  return {
    result,
    filteredResult,
    search,
    setSearch,
    searchSuggestions,
    searchMatchCount,
    selectSearchTicker,
    minScore,
    setMinScore,
    scanMode,
    setScanMode,
    simulationDate,
    setSimulationDate,
    loading,
    runPending,
    error,
    message,
    tickerPending,
    detail,
    setDetail,
    loadResult,
    runScan,
    setActive,
  };
}
