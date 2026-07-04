import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DynamicStrategyApiError,
  fetchDynamicCatalog,
  postDynamicEvaluate,
  dynamicStrategiesUseMock,
  type DynamicStrategy,
} from "../api/dynamic-strategy-client";
import {
  PREMARKET_ERROR_MESSAGES,
  PremarketApiError,
  fetchPremarketResult,
  pollPremarketEvaluate,
  postPremarketStop,
} from "../api/premarket-client";
import type { PremarketResultResponse } from "../types";
import {
  formatSimulationTimeEt,
  isAssessmentNow,
  parseEtDatetimeLocal,
  parseSimulationTimeEt,
  type AssessmentTimeMode,
} from "@/features/market/lib/assessment-time";
import { canStopPremarketEvaluate, isPremarketEvaluateActive } from "../display";

const DEFAULT_THRESHOLD = 0;

function resolveError(err: unknown): string {
  if (err instanceof DynamicStrategyApiError || err instanceof PremarketApiError) {
    const code = err.code;
    if (code && PREMARKET_ERROR_MESSAGES[code]) {
      return PREMARKET_ERROR_MESSAGES[code];
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Premarket request failed.";
}

function isEvaluateConflict(err: unknown): boolean {
  if (err instanceof DynamicStrategyApiError || err instanceof PremarketApiError) {
    return err.code === "DYNAMIC_EVAL_CONFLICT" || err.code === "PREMARKET_CONFLICT";
  }
  return false;
}

export function usePremarketWorkspace() {
  const useMock = dynamicStrategiesUseMock();

  const [strategies, setStrategies] = useState<DynamicStrategy[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [result, setResult] = useState<PremarketResultResponse | null>(null);
  const [resultLoading, setResultLoading] = useState(true);
  const [startPending, setStartPending] = useState(false);
  const [stopPending, setStopPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const evaluateInFlightRef = useRef(false);

  const [assessmentMode, setAssessmentModeState] = useState<AssessmentTimeMode>("now");
  const [assessmentAt, setAssessmentAt] = useState<Date>(() => new Date());
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);

  const activeStrategies = useMemo(
    () => strategies.filter((s) => s.active),
    [strategies],
  );

  const reloadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const catalog = await fetchDynamicCatalog();
      const rows = (catalog.strategies ?? []).map((row) => ({
        ...row,
        active: row.active !== false,
        rules: row.rules ?? [],
      })) as DynamicStrategy[];
      setStrategies(rows);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Failed to load dynamic catalog.");
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const loadResult = useCallback(async (runId?: string | null) => {
    setError(null);
    try {
      const payload = await fetchPremarketResult(runId ?? result?.runId);
      setResult(payload);
      if (payload?.signalThresholdPct != null) {
        setThreshold(payload.signalThresholdPct);
      }
      return payload;
    } catch (err) {
      if (err instanceof PremarketApiError && err.code === "PREMARKET_NOT_FOUND") {
        setResult(null);
        return null;
      }
      setError(resolveError(err));
      return null;
    }
  }, [result?.runId]);

  useEffect(() => {
    void reloadCatalog();
  }, [reloadCatalog]);

  useEffect(() => {
    let cancelled = false;
    setResultLoading(true);
    void (async () => {
      try {
        const payload = await fetchPremarketResult();
        if (!cancelled) {
          setResult(payload);
          if (payload?.signalThresholdPct != null) {
            setThreshold(payload.signalThresholdPct);
          }
          const sim = parseSimulationTimeEt(payload?.simulationTimeEt);
          if (sim && !isAssessmentNow(sim)) {
            setAssessmentModeState("et");
            setAssessmentAt(sim);
          }
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof PremarketApiError && err.code === "PREMARKET_NOT_FOUND") {
            setResult(null);
          } else {
            setError(resolveError(err));
          }
        }
      } finally {
        if (!cancelled) setResultLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolveEvaluateRequest = useCallback(() => {
    if (assessmentMode === "et") {
      return {
        assessmentTimeMode: "et" as const,
        simulationTimeEt: formatSimulationTimeEt(assessmentAt),
      };
    }
    return { assessmentTimeMode: "now" as const };
  }, [assessmentAt, assessmentMode]);

  const setAssessmentMode = useCallback((mode: AssessmentTimeMode) => {
    setAssessmentModeState(mode);
    setAssessmentError(null);
    if (mode === "et") {
      setAssessmentAt((prev) => prev);
    }
  }, []);

  const setAssessmentFromLocal = useCallback((localValue: string) => {
    const parsed = parseEtDatetimeLocal(localValue);
    if (!parsed) {
      setAssessmentError("Invalid date or time.");
      return;
    }
    setAssessmentModeState("et");
    setAssessmentAt(parsed);
    setAssessmentError(null);
  }, []);

  const setThresholdPct = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    setThreshold(clamped);
  }, []);

  const startEvaluate = useCallback(
    async (allowRetry = true) => {
      if (evaluateInFlightRef.current) return;
      if (assessmentMode === "et" && assessmentError) return;

      evaluateInFlightRef.current = true;
      setStartPending(true);
      setError(null);
      setNotice(null);
      const evaluateRequest = {
        ...resolveEvaluateRequest(),
        options: { signalThresholdPct: threshold },
      };

      try {
        const ids = activeStrategies.map((s) => s.id);
        if (ids.length === 0) {
          setError("No active strategies — activate a dynamic strategy in Admin first.");
          return;
        }
        const payload = await postDynamicEvaluate({
          strategyIds: ids,
          ...evaluateRequest,
        });
        setResult((prev) => ({
          ...(prev ?? { strategies: [] }),
          runId: payload.runId,
          status: payload.status ?? "running",
          simulationTimeEt: payload.simulationTimeEt,
          tradeDate: payload.tradeDate,
          signalThresholdPct: payload.signalThresholdPct ?? threshold,
        }));
        await pollPremarketEvaluate(payload.runId, (progress) => {
          setResult(progress);
        });
        setNotice(
          payload.message ?? "Evaluate started. Use Refresh result to load results.",
        );
      } catch (err) {
        if (allowRetry && isEvaluateConflict(err)) {
          await new Promise((resolve) => window.setTimeout(resolve, 400));
          evaluateInFlightRef.current = false;
          setStartPending(false);
          return startEvaluate(false);
        }
        setError(resolveError(err));
      } finally {
        evaluateInFlightRef.current = false;
        setStartPending(false);
      }
    },
    [activeStrategies, assessmentError, assessmentMode, resolveEvaluateRequest, threshold],
  );

  const stopEvaluate = useCallback(async () => {
    setStopPending(true);
    setNotice(null);
    try {
      const payload = await postPremarketStop();
      setNotice(payload.message ?? "Stop requested.");
      setResult((prev) =>
        prev ? { ...prev, status: payload.status ?? "stopping", stopped: true } : prev,
      );
    } catch (err) {
      setError(resolveError(err));
    } finally {
      setStopPending(false);
    }
  }, []);

  const refreshResult = useCallback(async () => {
    setResultLoading(true);
    setError(null);
    try {
      await loadResult(result?.runId);
    } finally {
      setResultLoading(false);
    }
  }, [loadResult, result?.runId]);

  const evaluateRunning = startPending || isPremarketEvaluateActive(result?.status);
  const canStopEvaluate = canStopPremarketEvaluate(result?.status, startPending);

  return {
    useMock,
    strategies,
    activeStrategies,
    reloadCatalog,
    catalogLoading,
    catalogError,
    result,
    loading: catalogLoading || resultLoading,
    startPending,
    evaluateRunning,
    canStopEvaluate,
    stopPending,
    error,
    notice,
    threshold: result?.signalThresholdPct ?? threshold,
    thresholdInput: threshold,
    setThresholdPct,
    assessmentMode,
    assessmentAt,
    assessmentError,
    setAssessmentMode,
    setAssessmentFromLocal,
    startEvaluate,
    stopEvaluate,
    refreshResult,
  };
}
