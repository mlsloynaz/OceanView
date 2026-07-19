import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  getAdminTickers,
  postCandlesRefresh,
  postCandlesReset,
  postCandlesResult,
  postCandlesStatus,
  postMovementProfilesBuild,
  postMovementProfilesStop,
} from "../api/candles-client";
import { bannerFromJob } from "../display";
import type {
  AdminTicker,
  CandlesBanner,
  SymbolCandleRow,
} from "../types";

export type CandlesPaneRow = AdminTicker & {
  candle: SymbolCandleRow | null;
};

const POLL_MS = 2500;
const POLL_MAX_MS = 15 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useCandlesPane(open: boolean) {
  const [catalog, setCatalog] = useState<AdminTicker[]>([]);
  const [symbols, setSymbols] = useState<SymbolCandleRow[]>([]);
  const [banner, setBanner] = useState<CandlesBanner | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rowPending, setRowPending] = useState<Record<string, boolean>>({});
  const [bulkPending, startBulkTransition] = useTransition();
  const [profileJobPending, setProfileJobPending] = useState(false);
  const pollGeneration = useRef(0);

  const tickerSymbols = useMemo(
    () => catalog.map((t) => t.symbol.trim().toUpperCase()).filter(Boolean),
    [catalog],
  );

  const rows: CandlesPaneRow[] = useMemo(() => {
    const bySymbol = new Map(symbols.map((s) => [s.symbol.toUpperCase(), s]));
    return catalog.map((ticker) => ({
      ...ticker,
      candle: bySymbol.get(ticker.symbol.toUpperCase()) ?? null,
    }));
  }, [catalog, symbols]);

  const loadPanel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { tickers } = await getAdminTickers();
      setCatalog(tickers);
      const symbolsList = tickers.map((t) => t.symbol);
      if (symbolsList.length === 0) {
        setSymbols([]);
        setBanner({
          kind: "none",
          title: "Candle intake",
          body: "No tickers in catalog.",
        });
        return;
      }
      const result = await postCandlesResult({ tickers: symbolsList });
      setSymbols(result.symbols);
      setBanner(result.banner);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load candles panel.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadPanel();
  }, [open, loadPanel]);

  useEffect(() => {
    return () => {
      pollGeneration.current += 1;
    };
  }, []);

  const pollJobUntilDone = useCallback(async (statusTickers: string[]) => {
    const gen = ++pollGeneration.current;
    const started = Date.now();
    while (Date.now() - started < POLL_MAX_MS) {
      if (gen !== pollGeneration.current) return;
      await sleep(POLL_MS);
      if (gen !== pollGeneration.current) return;
      const status = await postCandlesStatus({ tickers: statusTickers });
      if (gen !== pollGeneration.current) return;
      setSymbols(status.symbols);
      setBanner(bannerFromJob(status.job));
      const jobStatus = String(status.job?.status || "").toLowerCase();
      if (jobStatus && jobStatus !== "running" && jobStatus !== "stopping") {
        const progress = status.job?.progress;
        const done =
          progress && typeof progress.completed === "number" && typeof progress.total === "number"
            ? `${progress.completed}/${progress.total}`
            : null;
        setMessage(
          done
            ? `Candle job ${jobStatus} (${done}).`
            : `Candle job ${jobStatus}.`,
        );
        return;
      }
      const progress = status.job?.progress;
      if (progress && typeof progress.completed === "number" && typeof progress.total === "number") {
        setMessage(`Candle job running… ${progress.completed}/${progress.total}`);
      }
    }
    setMessage("Candle job still running — use Refresh status or Admin → Job Status.");
  }, []);

  const refreshStatus = useCallback(() => {
    if (tickerSymbols.length === 0) return;
    setMessage(null);
    setError(null);
    startBulkTransition(async () => {
      try {
        const status = await postCandlesStatus({ tickers: tickerSymbols });
        setSymbols(status.symbols);
        setBanner(bannerFromJob(status.job));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to refresh status.");
      }
    });
  }, [tickerSymbols]);

  const refreshCandles = useCallback(
    (tickers: string[]) => {
      if (tickers.length === 0) return;
      setMessage(null);
      setError(null);
      const pendingKeys = Object.fromEntries(tickers.map((s) => [s.toUpperCase(), true]));
      setRowPending((prev) => ({ ...prev, ...pendingKeys }));

      startBulkTransition(async () => {
        try {
          const ack = await postCandlesRefresh({ tickers });
          setMessage(ack.message);
          const statusTickers = tickerSymbols.length > 0 ? tickerSymbols : tickers;
          if (String(ack.status).toLowerCase() === "running") {
            await pollJobUntilDone(statusTickers);
          } else {
            const status = await postCandlesStatus({ tickers: statusTickers });
            setSymbols(status.symbols);
            setBanner(bannerFromJob(status.job));
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Candle refresh failed.");
        } finally {
          setRowPending((prev) => {
            const next = { ...prev };
            for (const symbol of tickers) delete next[symbol.toUpperCase()];
            return next;
          });
        }
      });
    },
    [tickerSymbols, pollJobUntilDone],
  );

  const resetCandles = useCallback(() => {
    if (tickerSymbols.length === 0) return;
    const confirmed = window.confirm(
      `Reset candles for all ${tickerSymbols.length} ticker(s)? This triggers a full D + 1h + 15m re-fetch in background batches.`,
    );
    if (!confirmed) return;

    setMessage(null);
    setError(null);
    startBulkTransition(async () => {
      try {
        const ack = await postCandlesReset({ tickers: tickerSymbols });
        setMessage(ack.message);
        if (String(ack.status).toLowerCase() === "running") {
          await pollJobUntilDone(tickerSymbols);
        } else {
          const status = await postCandlesStatus({ tickers: tickerSymbols });
          setSymbols(status.symbols);
          setBanner(bannerFromJob(status.job));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Candle reset failed.");
      }
    });
  }, [tickerSymbols, pollJobUntilDone]);

  const refreshAll = useCallback(() => {
    setMessage(null);
    setError(null);
    startBulkTransition(async () => {
      try {
        const { tickers } = await getAdminTickers();
        setCatalog(tickers);
        const symbolsList = tickers.map((t) => t.symbol.trim().toUpperCase()).filter(Boolean);
        if (symbolsList.length === 0) {
          setMessage("No active tickers — activate symbols in Tickers first.");
          return;
        }
        const pendingKeys = Object.fromEntries(symbolsList.map((s) => [s, true]));
        setRowPending(pendingKeys);
        const ack = await postCandlesRefresh({ tickers: symbolsList });
        setMessage(`${ack.message} (${symbolsList.length} active ticker(s))`);
        if (String(ack.status).toLowerCase() === "running") {
          await pollJobUntilDone(symbolsList);
        } else {
          const status = await postCandlesStatus({ tickers: symbolsList });
          setSymbols(status.symbols);
          setBanner(bannerFromJob(status.job));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Candle refresh failed.");
      } finally {
        setRowPending({});
      }
    });
  }, [pollJobUntilDone]);

  const buildMovementProfiles = useCallback(() => {
    if (tickerSymbols.length === 0) return;
    const confirmed = window.confirm(
      `Build movement profiles for ${tickerSymbols.length} active ticker(s)?\n\n` +
        `Fetches ~1 year of hourly RTH bars per ticker into memory (batches of 5), ` +
        `saves only the compact profile — does not store that history in Candles.`,
    );
    if (!confirmed) return;

    setMessage(null);
    setError(null);
    setProfileJobPending(true);
    startBulkTransition(async () => {
      try {
        const { tickers } = await getAdminTickers();
        setCatalog(tickers);
        const symbolsList = tickers.map((t) => t.symbol.trim().toUpperCase()).filter(Boolean);
        if (symbolsList.length === 0) {
          setMessage("No active tickers — activate symbols in Tickers first.");
          return;
        }
        const ack = await postMovementProfilesBuild({ tickers: symbolsList, batchSize: 5 });
        setMessage(
          `${ack.message} (${symbolsList.length} ticker(s), batches of 5). Progress: Admin → Job Status.`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Movement profile build failed.");
      } finally {
        setProfileJobPending(false);
      }
    });
  }, [tickerSymbols]);

  const stopMovementProfiles = useCallback(() => {
    setMessage(null);
    setError(null);
    setProfileJobPending(true);
    startBulkTransition(async () => {
      try {
        const ack = await postMovementProfilesStop();
        setMessage(ack.message ?? `Stop requested (${ack.status}).`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to stop movement profile job.");
      } finally {
        setProfileJobPending(false);
      }
    });
  }, []);

  const refreshOne = useCallback(
    (symbol: string) => {
      refreshCandles([symbol]);
    },
    [refreshCandles],
  );

  return {
    rows,
    banner,
    message,
    error,
    loading,
    bulkPending,
    profileJobPending,
    rowPending,
    refreshStatus,
    refreshAll,
    refreshOne,
    resetCandles,
    buildMovementProfiles,
    stopMovementProfiles,
    reload: loadPanel,
  };
}
