import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  defaultSimulationSessionDate,
  validateSimulationSessionDate,
} from "@/shared/lib/market-calendar";
import { getTickersCatalog, patchTickerActive } from "../../tickers/api/tickers-client";
import {
  getSetupScanResult,
  pollSetupScanResult,
  postSetupScanRun,
  SetupScanApiError,
} from "../api/preselection-client";
import {
  buildSemiFinalTickerGroups,
  filterSemiFinalTickerGroups,
  semiFinalTickerMatchCount,
  semiFinalTickerSearchSuggestions,
} from "../group-by-ticker";
import { mergePreselectionWithCatalogActive } from "../merge-catalog-active";
import {
  filterSemiFinalResult,
} from "../search";
import type { PreselectionResultResponse, PreselectionTickerRow } from "../types";

export type SetupScanMode = "live" | "simulate";

export function useSetupScanPane(open: boolean) {
  const [result, setResult] = useState<PreselectionResultResponse | null>(null);
  const [minScore, setMinScore] = useState(0);
  const [scanMode, setScanModeState] = useState<SetupScanMode>("live");
  const [simulationDate, setSimulationDateState] = useState("");
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

  const setScanMode = useCallback((mode: SetupScanMode) => {
    setScanModeState(mode);
    setError(null);
    if (mode === "simulate") {
      setSimulationDateState((prev) =>
        prev && !validateSimulationSessionDate(prev) ? prev : defaultSimulationSessionDate(),
      );
    }
  }, []);

  const setSimulationDate = useCallback((dateStr: string) => {
    setSimulationDateState(dateStr);
    if (!dateStr.trim()) {
      setError(null);
      return;
    }
    setError(validateSimulationSessionDate(dateStr.trim()));
  }, []);

  useEffect(() => {
    if (scanMode !== "simulate") return;
    setSimulationDateState((prev) =>
      prev && !validateSimulationSessionDate(prev) ? prev : defaultSimulationSessionDate(),
    );
  }, [scanMode]);

  const selectSearchTicker = useCallback((symbol: string) => {
    setSearch(symbol);
  }, []);

  const applyCatalogActive = useCallback(
    async (payload: PreselectionResultResponse) => {
      const { tickers } = await getTickersCatalog();
      return mergePreselectionWithCatalogActive(payload, tickers ?? []);
    },
    [],
  );

  const loadResult = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [payload, catalog] = await Promise.all([
        getSetupScanResult(),
        getTickersCatalog(),
      ]);
      const merged = mergePreselectionWithCatalogActive(payload, catalog.tickers ?? []);
      setResult(merged);
      const status = (merged.status ?? "").toLowerCase();
      if (status === "running" || status === "pending") {
        setMessage(
          merged.progress?.done != null && merged.progress?.total != null
            ? `Scan in progress… ${merged.progress.done}/${merged.progress.total}`
            : "Scan in progress…",
        );
        const runId = merged.runId;
        try {
          const finalPayload = await pollSetupScanResult(runId, (progress) => {
            const done = progress.progress?.done;
            const total = progress.progress?.total;
            if (done != null && total != null) {
              setMessage(`Scanning… ${done}/${total}`);
            }
          });
          setResult(await applyCatalogActive(finalPayload));
          setMessage(finalPayload.message ?? "Tickers SemiFinal complete.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Tickers SemiFinal failed.");
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load Tickers SemiFinal result.";
      if (!msg.toLowerCase().includes("not found")) {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [applyCatalogActive]);

  useEffect(() => {
    if (!open) return;
    void loadResult();
  }, [open, loadResult]);

  const filteredResult = useMemo(
    () => filterSemiFinalResult(result, search),
    [result, search],
  );

  const tickerGroups = useMemo(
    () => buildSemiFinalTickerGroups(filteredResult),
    [filteredResult],
  );

  const filteredTickerGroups = useMemo(
    () => filterSemiFinalTickerGroups(tickerGroups, search),
    [tickerGroups, search],
  );

  const searchSuggestions = useMemo(
    () => semiFinalTickerSearchSuggestions(tickerGroups, search),
    [tickerGroups, search],
  );

  const searchMatchCount = useMemo(
    () => semiFinalTickerMatchCount(tickerGroups, search),
    [tickerGroups, search],
  );

  const runScan = useCallback(() => {
    startRunTransition(async () => {
      setError(null);
      setMessage(null);
      if (scanMode === "simulate") {
        if (!simulationDate.trim()) {
          setError("Pick a session date for simulation.");
          return;
        }
        const dateError = validateSimulationSessionDate(simulationDate.trim());
        if (dateError) {
          setError(dateError);
          return;
        }
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
        setMessage(
          (ack.message ?? "").toLowerCase().includes("poll")
            ? "Tickers SemiFinal started…"
            : (ack.message ?? "Tickers SemiFinal started…"),
        );
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
        const strategies = Array.isArray(prev.strategies) ? prev.strategies : [];
        return {
          ...prev,
          strategies: strategies.map((group) => ({
            ...group,
            tickers: (Array.isArray(group.tickers) ? group.tickers : []).map((row) =>
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
    tickerGroups: filteredTickerGroups,
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
