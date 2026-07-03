import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DynamicStrategyApiError,
  createDynamicStrategy,
  fetchDynamicCatalog,
  fetchDynamicRules,
  patchDynamicStrategy,
  postDynamicEvaluate,
  dynamicStrategiesUseMock,
  type DynamicRuleTemplate,
  type DynamicStrategy,
} from "../api/dynamic-strategy-client";
import {
  PREMARKET_ERROR_MESSAGES,
  PremarketApiError,
  fetchPremarketResult,
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
  const [rules, setRules] = useState<DynamicRuleTemplate[]>([]);

  const [editingStrategyId, setEditingStrategyId] = useState<string | null>(null);
  const [builderName, setBuilderName] = useState("");
  const [builderShortName, setBuilderShortName] = useState("");
  const [builderDescription, setBuilderDescription] = useState("");
  const [builderDirection, setBuilderDirection] = useState<"" | "CALL" | "PUT">("");
  const [selectedRuleKeys, setSelectedRuleKeys] = useState<string[]>([]);
  const [builderOpen, setBuilderOpen] = useState(false);

  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogSaving, setCatalogSaving] = useState(false);
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
      const [catalog, rulesPayload] = await Promise.all([
        fetchDynamicCatalog(),
        fetchDynamicRules(),
      ]);
      const rows = (catalog.strategies ?? []).map((row) => ({
        ...row,
        active: row.active !== false,
        rules: row.rules ?? [],
      })) as DynamicStrategy[];
      setStrategies(rows);
      setRules(rulesPayload.rules ?? []);
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

  const clearBuilder = useCallback(() => {
    setEditingStrategyId(null);
    setBuilderName("");
    setBuilderShortName("");
    setBuilderDescription("");
    setBuilderDirection("");
    setSelectedRuleKeys([]);
    setCatalogError(null);
    setNotice(null);
  }, []);

  const closeBuilder = useCallback(() => {
    clearBuilder();
    setBuilderOpen(false);
  }, [clearBuilder]);

  const openBuilderForNew = useCallback(() => {
    clearBuilder();
    setBuilderOpen(true);
  }, [clearBuilder]);

  const loadStrategyForEdit = useCallback((strategy: DynamicStrategy) => {
    setEditingStrategyId(strategy.id);
    setBuilderName(strategy.name);
    setBuilderShortName(strategy.shortName ?? "");
    setBuilderDescription(strategy.description ?? "");
    setBuilderDirection(strategy.direction ?? "");
    setSelectedRuleKeys(strategy.rules.map((r) => r.ruleKey));
    setCatalogError(null);
    setBuilderOpen(true);
  }, []);

  const addRuleToBuilder = useCallback((ruleKey: string) => {
    setSelectedRuleKeys((prev) => (prev.includes(ruleKey) ? prev : [...prev, ruleKey]));
  }, []);

  const removeRuleFromBuilder = useCallback((ruleKey: string) => {
    setSelectedRuleKeys((prev) => prev.filter((k) => k !== ruleKey));
  }, []);

  const moveRuleInBuilder = useCallback((ruleKey: string, direction: "up" | "down") => {
    setSelectedRuleKeys((prev) => {
      const index = prev.indexOf(ruleKey);
      if (index < 0) return prev;
      const next = [...prev];
      const swap = direction === "up" ? index - 1 : index + 1;
      if (swap < 0 || swap >= next.length) return prev;
      [next[index], next[swap]] = [next[swap], next[index]];
      return next;
    });
  }, []);

  const saveBuilder = useCallback(async () => {
    const name = builderName.trim();
    if (!name || selectedRuleKeys.length === 0) {
      setCatalogError("Name and at least one rule are required.");
      return null;
    }
    setCatalogSaving(true);
    setCatalogError(null);
    try {
      const wasEdit = editingStrategyId != null;
      const directionPayload = wasEdit
        ? { direction: builderDirection || ("" as const) }
        : builderDirection
          ? { direction: builderDirection }
          : {};
      const payload = {
        name,
        shortName: builderShortName.trim() || undefined,
        description: builderDescription.trim() || undefined,
        ...directionPayload,
        ruleKeys: selectedRuleKeys,
        active: true,
      };
      const saved = wasEdit
        ? await patchDynamicStrategy(editingStrategyId, payload)
        : await createDynamicStrategy(payload);
      clearBuilder();
      setBuilderOpen(false);
      await reloadCatalog();
      setNotice(
        wasEdit
          ? `Strategy "${saved.name}" updated.`
          : `Strategy "${saved.name}" saved to Dynamo.`,
      );
      return saved;
    } catch (err) {
      setCatalogError(resolveError(err));
      return null;
    } finally {
      setCatalogSaving(false);
    }
  }, [
    builderDescription,
    builderDirection,
    builderName,
    builderShortName,
    clearBuilder,
    editingStrategyId,
    reloadCatalog,
    selectedRuleKeys,
  ]);

  const toggleStrategyActive = useCallback(
    async (strategy: DynamicStrategy) => {
      setCatalogSaving(true);
      setCatalogError(null);
      try {
        await patchDynamicStrategy(strategy.id, { active: !strategy.active });
        await reloadCatalog();
      } catch (err) {
        setCatalogError(resolveError(err));
      } finally {
        setCatalogSaving(false);
      }
    },
    [reloadCatalog],
  );

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
    async (mode: "strategies" | "rules" = "strategies", allowRetry = true) => {
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
        if (mode === "rules") {
          if (selectedRuleKeys.length === 0) {
            setError("Add at least one rule in the builder to preview.");
            return;
          }
          const payload = await postDynamicEvaluate({
            ruleKeys: selectedRuleKeys,
            ...evaluateRequest,
          });
          setResult(payload);
          setNotice(payload.message ?? "Preview evaluate complete.");
          return;
        }

        const ids = activeStrategies.map((s) => s.id);
        if (ids.length === 0) {
          setError("No active strategies — activate a dynamic strategy first.");
          return;
        }
        const payload = await postDynamicEvaluate({
          strategyIds: ids,
          ...evaluateRequest,
        });
        setResult(payload);
        setNotice(payload.message ?? "Evaluate complete.");
      } catch (err) {
        if (allowRetry && isEvaluateConflict(err)) {
          await new Promise((resolve) => window.setTimeout(resolve, 400));
          evaluateInFlightRef.current = false;
          setStartPending(false);
          return startEvaluate(mode, false);
        }
        setError(resolveError(err));
      } finally {
        evaluateInFlightRef.current = false;
        setStartPending(false);
      }
    },
    [activeStrategies, assessmentError, assessmentMode, resolveEvaluateRequest, selectedRuleKeys, threshold],
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

  const evaluateRunning =
    startPending || (result?.status ?? "").toLowerCase() === "running";

  return {
    useMock,
    strategies,
    rules,
    activeStrategies,
    editingStrategyId,
    builderName,
    builderShortName,
    builderDescription,
    builderDirection,
    selectedRuleKeys,
    setBuilderName,
    setBuilderShortName,
    setBuilderDescription,
    setBuilderDirection,
    addRuleToBuilder,
    removeRuleFromBuilder,
    moveRuleInBuilder,
    clearBuilder,
    closeBuilder,
    openBuilderForNew,
    loadStrategyForEdit,
    saveBuilder,
    toggleStrategyActive,
    reloadCatalog,
    catalogLoading,
    catalogSaving,
    catalogError,
    builderOpen,
    result,
    loading: catalogLoading || resultLoading,
    startPending,
    evaluateRunning,
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
