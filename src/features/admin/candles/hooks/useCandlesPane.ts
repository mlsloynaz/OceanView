import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  getAdminTickers,
  postCandlesRefresh,
  postCandlesReset,
  postCandlesResult,
  postCandlesStatus,
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

export function useCandlesPane(open: boolean) {
  const [catalog, setCatalog] = useState<AdminTicker[]>([]);
  const [symbols, setSymbols] = useState<SymbolCandleRow[]>([]);
  const [banner, setBanner] = useState<CandlesBanner | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rowPending, setRowPending] = useState<Record<string, boolean>>({});
  const [bulkPending, startBulkTransition] = useTransition();
  const loadedRef = useRef(false);

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
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    void loadPanel();
  }, [open, loadPanel]);

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
    [],
  );

  const resetCandles = useCallback(() => {
    if (tickerSymbols.length === 0) return;
    const confirmed = window.confirm(
      `Reset candles for all ${tickerSymbols.length} ticker(s)? This triggers a full D + 1h + 15m re-fetch.`,
    );
    if (!confirmed) return;

    setMessage(null);
    setError(null);
    startBulkTransition(async () => {
      try {
        const ack = await postCandlesReset({ tickers: tickerSymbols });
        setMessage(ack.message);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Candle reset failed.");
      }
    });
  }, [tickerSymbols]);

  const refreshAll = useCallback(() => {
    refreshCandles(tickerSymbols);
  }, [refreshCandles, tickerSymbols]);

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
    rowPending,
    refreshStatus,
    refreshAll,
    refreshOne,
    resetCandles,
    reload: loadPanel,
  };
}
