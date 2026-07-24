import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pollLab1Monitor, startLab1Monitor, stopLab1Monitor } from "../api/lab-client";
import type { Lab1MonitorResponse } from "../types";

const DEFAULT_POLL_MS = 30_000;

export function useLab1Monitor(open: boolean) {
  const [state, setState] = useState<Lab1MonitorResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const monitorIdRef = useRef<string | null>(null);

  const running = useMemo(
    () => String(state?.status || "").toLowerCase() === "running",
    [state?.status],
  );

  const refreshIdle = useCallback(async () => {
    try {
      const payload = await pollLab1Monitor(monitorIdRef.current);
      setState(payload);
      if (payload.monitorId) monitorIdRef.current = payload.monitorId;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Lab1 status.");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refreshIdle();
  }, [open, refreshIdle]);

  useEffect(() => {
    if (!open || !running) return;
    const pollMs = Math.max(5, Number(state?.pollIntervalSeconds) || 30) * 1000 || DEFAULT_POLL_MS;
    const id = window.setInterval(() => {
      void pollLab1Monitor(monitorIdRef.current)
        .then((payload) => {
          setState(payload);
          if (payload.monitorId) monitorIdRef.current = payload.monitorId;
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Lab1 poll failed.");
        });
    }, pollMs);
    return () => window.clearInterval(id);
  }, [open, running, state?.pollIntervalSeconds]);

  const start = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const payload = await startLab1Monitor();
      setState(payload);
      monitorIdRef.current = payload.monitorId ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start Lab1.");
    } finally {
      setLoading(false);
    }
  }, []);

  const stop = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const ack = await stopLab1Monitor(monitorIdRef.current);
      const payload = await pollLab1Monitor(monitorIdRef.current);
      setState({
        ...payload,
        status: ack.status || payload.status,
        message: ack.message || payload.message,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop Lab1.");
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    state,
    loading,
    error,
    running,
    start,
    stop,
  };
}
