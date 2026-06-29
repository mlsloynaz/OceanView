import { useCallback, useEffect, useState } from "react";
import {
  PREMARKET_ERROR_MESSAGES,
  PremarketApiError,
  fetchPremarketResult,
  postPremarketStart,
  postPremarketStop,
  premarketUsesMock,
} from "../api/premarket-client";
import type { PremarketResultResponse, PremarketStartRequest } from "../types";

const DEFAULT_THRESHOLD = 50;

export function usePremarketWorkspace() {
  const useMock = premarketUsesMock();
  const [result, setResult] = useState<PremarketResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [startPending, setStartPending] = useState(false);
  const [stopPending, setStopPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const resolveError = useCallback((err: unknown): string => {
    if (err instanceof PremarketApiError) {
      if (err.code && PREMARKET_ERROR_MESSAGES[err.code]) {
        return PREMARKET_ERROR_MESSAGES[err.code];
      }
      return err.message;
    }
    if (err instanceof Error) return err.message;
    return "Premarket request failed.";
  }, []);

  const loadResult = useCallback(
    async (runId?: string | null) => {
      setError(null);
      try {
        const payload = await fetchPremarketResult(runId ?? result?.runId);
        setResult(payload);
        return payload;
      } catch (err) {
        if (err instanceof PremarketApiError && err.code === "PREMARKET_NOT_FOUND") {
          setResult(null);
          return null;
        }
        setError(resolveError(err));
        return null;
      }
    },
    [resolveError, result?.runId],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const payload = await fetchPremarketResult();
        if (!cancelled) setResult(payload);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof PremarketApiError && err.code === "PREMARKET_NOT_FOUND") {
            setResult(null);
          } else {
            setError(resolveError(err));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolveError]);

  const startEvaluate = useCallback(
    async (request: PremarketStartRequest = {}) => {
      setStartPending(true);
      setError(null);
      setNotice(null);
      try {
        const body: PremarketStartRequest = {
          ...request,
          options: {
            signalThresholdPct: DEFAULT_THRESHOLD,
            ...request.options,
          },
        };
        const payload = await postPremarketStart(body);
        setResult(payload);
        setNotice(payload.message ?? "Premarket evaluate complete.");
      } catch (err) {
        setError(resolveError(err));
      } finally {
        setStartPending(false);
      }
    },
    [resolveError],
  );

  const stopEvaluate = useCallback(async () => {
    setStopPending(true);
    setNotice(null);
    try {
      const payload = await postPremarketStop();
      setNotice(payload.message ?? "Stop requested.");
    } catch (err) {
      setError(resolveError(err));
    } finally {
      setStopPending(false);
    }
  }, [resolveError]);

  const refreshResult = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadResult(result?.runId);
    } finally {
      setLoading(false);
    }
  }, [loadResult, result?.runId]);

  return {
    useMock,
    result,
    loading,
    startPending,
    stopPending,
    error,
    notice,
    threshold: DEFAULT_THRESHOLD,
    startEvaluate,
    stopEvaluate,
    refreshResult,
  };
}
