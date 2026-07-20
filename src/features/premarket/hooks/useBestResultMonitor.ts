import { useCallback, useEffect, useRef, useState } from "react";
import {
  BestResultApiError,
  fetchBestResultMonitorStatus,
  postBestResultMonitorStart,
  postBestResultMonitorStop,
  postBestResultRefresh,
} from "../api/best-result-client";
import type { BestResultMonitorStatus, BestResultMonitorTicker } from "../types";

/** Client-driven strike refresh while Start session is active. */
const STRIKE_POLL_MS = 5000;

type Args = {
  runId: string | null | undefined;
  hasBestResults: boolean;
  /** Reload premarket result after a full refresh */
  onRefreshed?: () => void | Promise<void>;
};

/**
 * Best Results strikes:
 * - **Refresh** — one-shot candles + reassess + option picks (all-in-one).
 * - **Start / Stop** — monitor session with 5s polling to keep refreshing best strikes.
 */
export function useBestResultMonitor({ runId, hasBestResults, onRefreshed }: Args) {
  const [status, setStatus] = useState<BestResultMonitorStatus | null>(null);
  const [startPending, setStartPending] = useState(false);
  const [stopPending, setStopPending] = useState(false);
  const [refreshPending, setRefreshPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const monitorIdRef = useRef<string | null>(null);
  const pollingRef = useRef(false);

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
      pollingRef.current = Boolean(next.monitorId);
      setStatus({ ...next, status: next.monitorId ? "running" : next.status });
      setNotice("Strike monitor started — refreshing best strikes every 5s. Stop to end.");
    } catch (err) {
      pollingRef.current = false;
      const message =
        err instanceof BestResultApiError ? err.message : "Failed to start strike monitor.";
      setError(message);
    } finally {
      setStartPending(false);
    }
  }, [runId, hasBestResults]);

  const stop = useCallback(async () => {
    setStopPending(true);
    setError(null);
    pollingRef.current = false;
    try {
      const next = await postBestResultMonitorStop(monitorIdRef.current);
      setStatus(next);
      monitorIdRef.current = null;
      setNotice("Strike monitor stopped.");
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
      setNotice(payload.message || "Best results refreshed (candles + reassess + strikes).");
      if (payload.tickers?.length) {
        const keepRunning = Boolean(monitorIdRef.current) && pollingRef.current;
        setStatus({
          monitorId: monitorIdRef.current ?? undefined,
          status: keepRunning ? "running" : "refreshed",
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

  const monitoringActive =
    status?.status === "running" && Boolean(monitorIdRef.current) && pollingRef.current;

  // Poll strike status while Start session is active.
  useEffect(() => {
    if (!monitoringActive) return;
    const id = monitorIdRef.current;
    if (!id) return;
    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (cancelled || inFlight || !pollingRef.current) return;
      inFlight = true;
      try {
        const next = await fetchBestResultMonitorStatus(id);
        if (cancelled) return;
        setStatus(next);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof BestResultApiError ? err.message : "Strike refresh failed.";
        setError(message);
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), STRIKE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [monitoringActive]);

  useEffect(() => {
    return () => {
      pollingRef.current = false;
      if (monitorIdRef.current) {
        void postBestResultMonitorStop(monitorIdRef.current).catch(() => undefined);
      }
    };
  }, []);

  const monitoring = status?.status === "running" && Boolean(monitorIdRef.current);
  const hasStrikeRows = (status?.tickers?.length ?? 0) > 0;
  const bySymbol = new Map<string, BestResultMonitorTicker>();
  for (const row of status?.tickers ?? []) {
    const key = `${row.symbol.toUpperCase()}|${row.direction ?? "NONE"}`;
    bySymbol.set(key, row);
    bySymbol.set(row.symbol.toUpperCase(), row);
  }

  return {
    status,
    running: monitoring || (hasStrikeRows && status?.status === "refreshed"),
    monitoring,
    startPending,
    stopPending,
    refreshPending,
    error,
    notice,
    start,
    stop,
    refresh,
    tickerMonitor: (symbol: string, direction?: string | null) =>
      bySymbol.get(`${symbol.toUpperCase()}|${direction ?? "NONE"}`) ??
      bySymbol.get(symbol.toUpperCase()) ??
      null,
    canStart:
      Boolean(runId) &&
      hasBestResults &&
      !startPending &&
      !refreshPending &&
      !monitoring &&
      !monitorIdRef.current,
    canStop: Boolean(monitorIdRef.current) && !stopPending,
    canRefresh: hasBestResults && !refreshPending && !startPending,
  };
}
