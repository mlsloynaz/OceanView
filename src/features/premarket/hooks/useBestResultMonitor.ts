import { useCallback, useEffect, useRef, useState } from "react";
import {
  BestResultApiError,
  fetchBestResultMonitorStatus,
  postBestResultMonitorStart,
  postBestResultMonitorStop,
} from "../api/best-result-client";
import type { BestResultMonitorStatus, BestResultMonitorTicker } from "../types";

const POLL_MS = 5000;

type Args = {
  runId: string | null | undefined;
  hasBestResults: boolean;
};

export function useBestResultMonitor({ runId, hasBestResults }: Args) {
  const [status, setStatus] = useState<BestResultMonitorStatus | null>(null);
  const [startPending, setStartPending] = useState(false);
  const [stopPending, setStopPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const monitorIdRef = useRef<string | null>(null);
  const pollInFlight = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPoll = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const pollOnce = useCallback(async () => {
    if (pollInFlight.current) return;
    const id = monitorIdRef.current;
    if (!id) return;
    pollInFlight.current = true;
    try {
      const next = await fetchBestResultMonitorStatus(id);
      setStatus(next);
      if (next.status !== "running") {
        clearPoll();
      }
    } catch (err) {
      const message =
        err instanceof BestResultApiError ? err.message : "Failed to refresh strike monitor.";
      setError(message);
    } finally {
      pollInFlight.current = false;
    }
  }, [clearPoll]);

  const start = useCallback(async () => {
    if (!runId || !hasBestResults) {
      setError("Run evaluate first so Best results has tickers.");
      return;
    }
    setStartPending(true);
    setError(null);
    try {
      const next = await postBestResultMonitorStart({ runId, moveCapPct: 12 });
      monitorIdRef.current = next.monitorId ?? null;
      setStatus(next);
      clearPoll();
      if (next.status === "running") {
        intervalRef.current = setInterval(() => {
          void pollOnce();
        }, POLL_MS);
      }
    } catch (err) {
      const message =
        err instanceof BestResultApiError ? err.message : "Failed to start strike monitor.";
      setError(message);
    } finally {
      setStartPending(false);
    }
  }, [runId, hasBestResults, clearPoll, pollOnce]);

  const stop = useCallback(async () => {
    setStopPending(true);
    setError(null);
    clearPoll();
    try {
      const next = await postBestResultMonitorStop(monitorIdRef.current);
      setStatus(next);
    } catch (err) {
      const message =
        err instanceof BestResultApiError ? err.message : "Failed to stop strike monitor.";
      setError(message);
    } finally {
      setStopPending(false);
    }
  }, [clearPoll]);

  useEffect(() => {
    return () => {
      clearPoll();
      if (monitorIdRef.current) {
        void postBestResultMonitorStop(monitorIdRef.current).catch(() => undefined);
      }
    };
  }, [clearPoll]);

  const running = status?.status === "running";
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
    error,
    start,
    stop,
    tickerMonitor: (symbol: string, direction?: string | null) =>
      bySymbol.get(`${symbol.toUpperCase()}|${direction ?? "NONE"}`) ??
      bySymbol.get(symbol.toUpperCase()) ??
      null,
    canStart: Boolean(runId) && hasBestResults && !running && !startPending,
    canStop: running && !stopPending,
  };
}
