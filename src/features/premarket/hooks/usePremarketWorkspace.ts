import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DynamicStrategyApiError,
  fetchDynamicCatalog,
  postDynamicEvaluate,
  dynamicStrategiesUseMock,
  type DynamicEvaluateRequest,
  type DynamicStrategy,
} from "../api/dynamic-strategy-client";
import {
  peekPremarketResultCache,
  peekPremarketStrategiesCache,
  setPremarketResultCache,
  setPremarketStrategiesCache,
  invalidatePremarketResultCache,
} from "../api/premarket-workspace-cache";
import { buildRulesPayload, type BuilderRuleRow } from "../lib/builder-utils";
import {
  PREMARKET_ERROR_MESSAGES,
  PremarketApiError,
  fetchPremarketResult,
  pollPremarketEvaluate,
  postPremarketStop,
} from "../api/premarket-client";
import type { PremarketResultResponse } from "../types";
import { fetchMarketEnvelope } from "@/features/market/api/market-client";
import { peekMarketWorkspaceCache } from "@/features/market/api/market-workspace-cache";
import {
  blocksAssess,
  clampAssessmentTime,
  coverageBoundsForInput,
  formatSimulationTimeEt,
  parseEtDatetimeLocal,
  type AssessmentTimeMode,
  validateAssessmentTime,
} from "@/features/market/lib/assessment-time";
import type { CandleCoverage } from "@/features/market/types";
import { defaultSimulationSessionDate } from "@/shared/lib/market-calendar";
import { canStopPremarketEvaluate, isPremarketEvaluateActive, isPremarketEvaluateTerminal } from "../display";
import {
  activeDynamicStrategyIds,
  activeDynamicStrategyLabel,
  countActiveDynamicStrategies,
} from "../lib/dynamic-strategies";
import {
  defaultPremarketAssessmentMode,
  persistPremarketAssessment,
  storedPremarketAssessmentAt,
} from "../lib/premarket-assessment-storage";

const DEFAULT_THRESHOLD = 0;
const BACKGROUND_POLL_MS = 2000;
const START_NOTICE_PREFIX = "Premarket evaluate started";

function isStartBoilerplateMessage(message: string | undefined): boolean {
  return Boolean(message?.trim().startsWith(START_NOTICE_PREFIX));
}

/** Single source of truth for the green status line under the toolbar. */
export function syncNoticeFromResult(payload: PremarketResultResponse | null): string | null {
  if (!payload || isPremarketEvaluateTerminal(payload.status)) {
    return null;
  }
  if (!isPremarketEvaluateActive(payload.status)) {
    return null;
  }
  return activeJobNotice(payload);
}

function activeJobNotice(payload: PremarketResultResponse | null): string | null {
  if (!payload || !isPremarketEvaluateActive(payload.status)) return null;
  const apiMessage = payload.message?.trim();
  if (apiMessage && !isStartBoilerplateMessage(apiMessage)) {
    return apiMessage;
  }
  const completed = payload.progress?.completed ?? 0;
  const total = payload.progress?.total ?? 0;
  const progress = total > 0 ? ` (${completed}/${total} symbols)` : "";
  if ((payload.status ?? "").toLowerCase() === "ready") {
    return `Early results available${progress}. Evaluate still running — Stop to cancel or Refresh for updates.`;
  }
  return `Evaluate in progress${progress}. Stop to cancel or Refresh for partial results.`;
}

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
  const cachedStrategies = peekPremarketStrategiesCache();
  const cachedResult = peekPremarketResultCache();
  const cachedEnvelope = peekMarketWorkspaceCache().envelope;

  const [dynamicStrategies, setDynamicStrategies] = useState<DynamicStrategy[]>(
    () => cachedStrategies ?? [],
  );
  const [activeStrategyIds, setActiveStrategyIds] = useState<string[]>(() =>
    cachedStrategies ? activeDynamicStrategyIds(cachedStrategies) : [],
  );
  const [evaluateGroupLabel, setEvaluateGroupLabel] = useState(() =>
    cachedStrategies ? activeDynamicStrategyLabel(cachedStrategies) : "Dynamic strategies",
  );
  const [catalogLoading, setCatalogLoading] = useState(() => !cachedStrategies);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [result, setResult] = useState<PremarketResultResponse | null>(() => cachedResult);
  const [resultLoading, setResultLoading] = useState(() => !cachedResult);
  const [startPending, setStartPending] = useState(false);
  const [stopPending, setStopPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(() => syncNoticeFromResult(cachedResult));
  const evaluateInFlightRef = useRef(false);

  const [assessmentMode, setAssessmentModeState] = useState<AssessmentTimeMode>(
    defaultPremarketAssessmentMode,
  );
  const [assessmentAt, setAssessmentAt] = useState<Date>(() => {
    if (defaultPremarketAssessmentMode() === "et") {
      return storedPremarketAssessmentAt() ?? new Date();
    }
    return new Date();
  });
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [assessmentNotice, setAssessmentNotice] = useState<string | null>(null);
  const [candleCoverage, setCandleCoverage] = useState<CandleCoverage | null>(
    () => cachedEnvelope?.candleCoverage ?? null,
  );
  const [coverageInitialized, setCoverageInitialized] = useState(
    () => Boolean(cachedEnvelope?.candleCoverage),
  );
  const [threshold, setThreshold] = useState(
    () => cachedResult?.signalThresholdPct ?? DEFAULT_THRESHOLD,
  );

  const applyAssessmentValidation = useCallback(
    (date: Date, coverage: CandleCoverage, historicalOnly = false) => {
      const validation = validateAssessmentTime(date, coverage, { historicalOnly });
      setAssessmentError(validation.error);
      setAssessmentNotice(validation.notice);
      return validation;
    },
    [],
  );

  const coverageBounds = useMemo(
    () => (candleCoverage ? coverageBoundsForInput(candleCoverage) : null),
    [candleCoverage],
  );

  const applyDynamicCatalog = useCallback((strategies: DynamicStrategy[]) => {
    const rows = strategies.map((row) => ({
      ...row,
      active: row.active !== false,
      rules: row.rules ?? [],
    }));
    setDynamicStrategies(rows);
    setActiveStrategyIds(activeDynamicStrategyIds(rows));
    setEvaluateGroupLabel(activeDynamicStrategyLabel(rows));
    setPremarketStrategiesCache(rows);
  }, []);

  const reloadCatalog = useCallback(async (opts?: { force?: boolean }) => {
    const hadCache = Boolean(peekPremarketStrategiesCache());
    if (!hadCache) setCatalogLoading(true);
    setCatalogError(null);
    try {
      const catalog = await fetchDynamicCatalog(opts);
      applyDynamicCatalog((catalog.strategies ?? []) as DynamicStrategy[]);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Failed to load dynamic strategies.");
    } finally {
      setCatalogLoading(false);
    }
  }, [applyDynamicCatalog]);

  const loadResult = useCallback(async (runId?: string | null) => {
    setError(null);
    try {
      const payload = await fetchPremarketResult(runId ?? result?.runId, { force: true });
      setResult(payload);
      setPremarketResultCache(payload);
      if (payload?.signalThresholdPct != null) {
        setThreshold(payload.signalThresholdPct);
      }
      setNotice(syncNoticeFromResult(payload));
      return payload;
    } catch (err) {
      if (err instanceof PremarketApiError && err.code === "PREMARKET_NOT_FOUND") {
        setResult(null);
        invalidatePremarketResultCache();
        setNotice(null);
        return null;
      }
      setError(resolveError(err));
      return null;
    }
  }, [result?.runId]);

  useEffect(() => {
    void reloadCatalog({ force: true });
  }, [reloadCatalog]);

  useEffect(() => {
    if (useMock) return;
    let cancelled = false;
    const cachedCov = peekMarketWorkspaceCache().envelope?.candleCoverage;
    if (cachedCov) setCandleCoverage(cachedCov);
    void fetchMarketEnvelope()
      .then((env) => {
        if (!cancelled && env.candleCoverage) {
          setCandleCoverage(env.candleCoverage);
        }
      })
      .catch(() => {
        /* evaluate still works; simulate bounds may be unavailable */
      });
    return () => {
      cancelled = true;
    };
  }, [useMock]);

  useEffect(() => {
    let cancelled = false;
    const hadResult = Boolean(peekPremarketResultCache());
    if (!hadResult) setResultLoading(true);
    void (async () => {
      try {
        const payload = await fetchPremarketResult(undefined, { force: true });
        if (!cancelled) {
          setResult(payload);
          setPremarketResultCache(payload);
          if (payload?.signalThresholdPct != null) {
            setThreshold(payload.signalThresholdPct);
          }
          setNotice(syncNoticeFromResult(payload));
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof PremarketApiError && err.code === "PREMARKET_NOT_FOUND") {
            setResult(null);
            invalidatePremarketResultCache();
            setNotice(null);
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

  useEffect(() => {
    if (startPending || !isPremarketEvaluateActive(result?.status)) {
      return;
    }
    const runId = result?.runId;
    let cancelled = false;
    const tick = async () => {
      try {
        const payload = await fetchPremarketResult(runId);
        if (cancelled) return;
        setResult(payload);
        setNotice(syncNoticeFromResult(payload));
      } catch {
        /* keep last result; user can Refresh manually */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), BACKGROUND_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [result?.runId, result?.status, startPending]);

  useEffect(() => {
    if (!candleCoverage || coverageInitialized) return;
    if (assessmentMode === "et") {
      const clamped = clampAssessmentTime(assessmentAt, candleCoverage);
      if (clamped.getTime() !== assessmentAt.getTime()) {
        setAssessmentAt(clamped);
      }
      applyAssessmentValidation(clamped, candleCoverage, true);
    } else {
      setAssessmentError(null);
      setAssessmentNotice(null);
    }
    setCoverageInitialized(true);
  }, [
    applyAssessmentValidation,
    assessmentAt,
    assessmentMode,
    candleCoverage,
    coverageInitialized,
  ]);

  useEffect(() => {
    if (!candleCoverage) return;
    if (assessmentMode === "now") {
      setAssessmentError(null);
      setAssessmentNotice(null);
      return;
    }
    applyAssessmentValidation(assessmentAt, candleCoverage, true);
  }, [applyAssessmentValidation, assessmentAt, assessmentMode, candleCoverage]);

  const resolveEvaluateRequest = useCallback(() => {
    if (assessmentMode === "et") {
      return {
        assessmentTimeMode: "et" as const,
        simulationTimeEt: formatSimulationTimeEt(assessmentAt),
      };
    }
    return { assessmentTimeMode: "now" as const };
  }, [assessmentAt, assessmentMode]);

  const followEvaluateRun = useCallback(
    async (payload: PremarketResultResponse, thresholdPct: number) => {
      setResult(payload);
      setPremarketResultCache(payload);
      setThreshold(thresholdPct);
      setNotice(syncNoticeFromResult(payload));
      if (isPremarketEvaluateTerminal(payload.status)) {
        return payload;
      }
      const polled = await pollPremarketEvaluate(payload.runId);
      if (polled) {
        setResult(polled);
        setPremarketResultCache(polled);
      }
      setNotice(syncNoticeFromResult(polled));
      return polled;
    },
    [],
  );

  const runEvaluateRequest = useCallback(
    async (body: DynamicEvaluateRequest) => {
      const payload = await postDynamicEvaluate(body);
      return followEvaluateRun(payload, body.options?.signalThresholdPct ?? threshold);
    },
    [followEvaluateRun, threshold],
  );

  const setAssessmentMode = useCallback(
    (mode: AssessmentTimeMode) => {
      setAssessmentModeState(mode);
      if (mode === "now") {
        persistPremarketAssessment("now", new Date());
        if (candleCoverage) {
          applyAssessmentValidation(new Date(), candleCoverage);
        } else {
          setAssessmentError(null);
          setAssessmentNotice(null);
        }
        return;
      }
      const fallbackSession = parseEtDatetimeLocal(`${defaultSimulationSessionDate()}T09:30`);
      const seed = storedPremarketAssessmentAt() ?? fallbackSession ?? new Date();
      const parsed = candleCoverage ? clampAssessmentTime(seed, candleCoverage) : seed;
      setAssessmentAt(parsed);
      persistPremarketAssessment("et", parsed);
      if (candleCoverage) {
        applyAssessmentValidation(parsed, candleCoverage, true);
      } else {
        setAssessmentError(null);
        setAssessmentNotice(null);
      }
    },
    [applyAssessmentValidation, candleCoverage],
  );

  const setAssessmentFromLocal = useCallback(
    (localValue: string) => {
      if (!localValue.trim()) {
        setAssessmentError(null);
        setAssessmentNotice(null);
        return;
      }
      const parsed = parseEtDatetimeLocal(localValue);
      if (!parsed) {
        setAssessmentError("Invalid date or time.");
        setAssessmentNotice(null);
        return;
      }
      setAssessmentModeState("et");
      setAssessmentAt(parsed);
      persistPremarketAssessment("et", parsed);
      if (candleCoverage) {
        applyAssessmentValidation(parsed, candleCoverage, true);
      } else {
        setAssessmentError(null);
        setAssessmentNotice(null);
      }
    },
    [applyAssessmentValidation, candleCoverage],
  );

  const setThresholdPct = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    setThreshold(clamped);
  }, []);

  const previewBuilderRules = useCallback(
    async (rows: BuilderRuleRow[]) => {
      if (rows.length === 0) {
        setError("Add at least one rule to preview.");
        return false;
      }
      if (
        assessmentMode === "et" &&
        (assessmentError ||
          (candleCoverage &&
            blocksAssess(assessmentAt, candleCoverage, { historicalOnly: true })))
      ) {
        return false;
      }
      if (evaluateInFlightRef.current) return false;
      evaluateInFlightRef.current = true;
      setStartPending(true);
      setError(null);
      setNotice(null);
      try {
        await runEvaluateRequest({
          rules: buildRulesPayload(rows),
          name: "Preview",
          ...resolveEvaluateRequest(),
          options: { signalThresholdPct: threshold },
        });
        setNotice("Preview complete — results are shown below.");
        return true;
      } catch (err) {
        setError(resolveError(err));
        return false;
      } finally {
        evaluateInFlightRef.current = false;
        setStartPending(false);
      }
    },
    [
      assessmentAt,
      assessmentError,
      assessmentMode,
      candleCoverage,
      resolveEvaluateRequest,
      runEvaluateRequest,
      threshold,
    ],
  );

  const startEvaluate = useCallback(async () => {
    if (evaluateInFlightRef.current) return;
    if (assessmentMode === "et" && assessmentError) return;
    if (
      assessmentMode === "et" &&
      candleCoverage &&
      blocksAssess(assessmentAt, candleCoverage, { historicalOnly: true })
    ) {
      return;
    }

    evaluateInFlightRef.current = true;
    setStartPending(true);
    setError(null);
    setNotice(null);

    try {
      if (activeStrategyIds.length === 0) {
        setError(
          "No active dynamic strategies — save a screen in Strategy builder and activate it.",
        );
        return;
      }
      await runEvaluateRequest({
        strategyIds: activeStrategyIds,
        ...resolveEvaluateRequest(),
        options: { signalThresholdPct: threshold },
      });
    } catch (err) {
      if (isEvaluateConflict(err)) {
        const existing = await loadResult();
        if (existing && isPremarketEvaluateActive(existing.status)) {
          setNotice(syncNoticeFromResult(existing));
          return;
        }
      }
      setError(resolveError(err));
    } finally {
      evaluateInFlightRef.current = false;
      setStartPending(false);
    }
  }, [
    assessmentAt,
    assessmentError,
    assessmentMode,
    candleCoverage,
    evaluateGroupLabel,
    activeStrategyIds,
    loadResult,
    resolveEvaluateRequest,
    runEvaluateRequest,
    threshold,
  ]);

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
  const canStopEvaluate = canStopPremarketEvaluate(
    result?.status,
    startPending,
    result?.canStop,
  );

  const activeStrategyCount = countActiveDynamicStrategies(dynamicStrategies);

  return {
    useMock,
    dynamicStrategies,
    activeStrategyIds,
    evaluateGroupLabel,
    activeStrategyCount,
    reloadCatalog,
    catalogLoading,
    catalogError,
    result,
    loading: (catalogLoading && dynamicStrategies.length === 0) || (resultLoading && !result),
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
    assessmentNotice,
    candleCoverage,
    coverageBounds,
    setAssessmentMode,
    setAssessmentFromLocal,
    startEvaluate,
    previewBuilderRules,
    stopEvaluate,
    refreshResult,
  };
}
