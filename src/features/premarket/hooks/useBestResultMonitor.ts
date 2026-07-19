import { useCallback, useEffect, useRef, useState } from "react";
import {
  BestResultApiError,
  fetchBestResultMonitorStatus,
  postBestResultMonitorStart,
  postBestResultMonitorStop,
  postBestResultRefresh,
} from "../api/best-result-client";
import type { BestResultMonitorStatus, BestResultMonitorTicker } from "../types";

type Args = {
  runId: string | null | undefined;
  hasBestResults: boolean;
  /** Reload premarket result after a full refresh */
  onRefreshed?: () => void | Promise<void>;
};

/**
 * Best Results strikes: one-shot Start / manual Scan — no 5s polling.
 * Refresh runs candles + reassess + option picks for best-result symbols.
 */
export function useBestResultMonitor({ runId, hasBestResults, onRefreshed }: Args) {
  const [status, setStatus] = useState<BestResultMonitorStatus | null>(null);
  const [startPending, setStartPending] = useState(false);
  const [stopPending, setStopPending] = useState(false);
  const [scanPending, setScanPending] = useState(false);
  const [refreshPending, setRefreshPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const monitorIdRef = useRef<string | null>(null);

  const start = useCallback(async () => {
    if (!runId || !hasBestResults) {
      setError("Run evaluate first so Best results has tickers.");
      return;
    }
    setStartPending(true);
    setError(null);
    setNotice(null);
    try {
      const next = await postBestResultMonitorStart({ runId });
      monitorIdRef.current = next.monitorId ?? null;
      setStatus(next);
      setNotice("Option picks loaded once — use Scan strikes or Refresh best results for updates.");
    } catch (err) {
      const message =
        err instanceof BestResultApiError ? err.message : "Failed to start strike monitor.";
      setError(message);
    } finally {
      setStartPending(false);
    }
  }, [runId, hasBestResults]);

  const scan = useCallback(async () => {
    const id = monitorIdRef.current;
    if (!id) {
      setError("Load strikes first (Start), or use Refresh best results.");
      return;
    }
    setScanPending(true);
    setError(null);
    try {
      const next = await fetchBestResultMonitorStatus(id);
      setStatus(next);
    } catch (err) {
      const message =
        err instanceof BestResultApiError ? err.message : "Failed to scan strikes.";
      setError(message);
    } finally {
      setScanPending(false);
    }
  }, []);

  const stop = useCallback(async () => {
    setStopPending(true);
    setError(null);
    try {
      const next = await postBestResultMonitorStop(monitorIdRef.current);
      setStatus(next);
      monitorIdRef.current = null;
    } catch (err) {
      const message =
        err instanceof BestResultApiError ? err.message : "Failed to stop strike monitor.";
      setError(message);
    } finally {
      setStopPending(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!runId && !hasBestResults) {
      setError("Run evaluate first so Best results has tickers.");
      return;
    }
    setRefreshPending(true);
    setError(null);
    setNotice(null);
    try {
      const payload = await postBestResultRefresh({
        runId: runId || undefined,
        refreshCandles: true,
        reassess: true,
        resolveStrikes: true,
      });
      setNotice(payload.message || "Best results refreshed.");
      if (payload.tickers?.length) {
        setStatus({
          monitorId: monitorIdRef.current ?? undefined,
          status: "refreshed",
          runId: payload.runId,
          polledAt: payload.refreshedAt,
          tickers: payload.tickers,
          message: payload.message,
        });
      }
      await onRefreshed?.();
    } catch (err) {
      const message =
        err instanceof BestResultApiError ? err.message : "Failed to refresh best results.";
      setError(message);
    } finally {
      setRefreshPending(false);
    }
  }, [runId, hasBestResults, onRefreshed]);

  useEffect(() => {
    return () => {
      if (monitorIdRef.current) {
        void postBestResultMonitorStop(monitorIdRef.current).catch(() => undefined);
      }
    };
  }, []);

  const running = status?.status === "running" || status?.status === "refreshed";
  const bySymbol = new Map<string, BestResultMonitorTicker>();
  for (const row of status?.tickers ?? []) {
    const key = `${row.symbol.toUpperCase()}|${row.direction ?? "NONE"}`;
    bySymbol.set(key, row);
    bySymbol.set(row.symbol.toUpperCase(), row);
  }

  return {
    status,
    running,
    startPending,
    stopPending,
    scanPending,
    refreshPending,
    error,
    notice,
    start,
    stop,
    scan,
    refresh,
    tickerMonitor: (symbol: string, direction?: string | null) =>
      bySymbol.get(`${symbol.toUpperCase()}|${direction ?? "NONE"}`) ??
      bySymbol.get(symbol.toUpperCase()) ??
      null,
    canStart: Boolean(runId) && hasBestResults && !startPending && !refreshPending,
    canStop: Boolean(monitorIdRef.current) && !stopPending,
    canScan: Boolean(monitorIdRef.current) && !scanPending && !refreshPending,
    canRefresh: hasBestResults && !refreshPending && !startPending,
  };
}
