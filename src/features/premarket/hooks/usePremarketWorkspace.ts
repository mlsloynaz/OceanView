import { useCallback, useEffect, useMemo, useState } from "react";
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

const DEFAULT_THRESHOLD = 50;

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

export function usePremarketWorkspace() {
  const useMock = dynamicStrategiesUseMock();

  const [strategies, setStrategies] = useState<DynamicStrategy[]>([]);
  const [rules, setRules] = useState<DynamicRuleTemplate[]>([]);

  const [editingStrategyId, setEditingStrategyId] = useState<string | null>(null);
  const [builderName, setBuilderName] = useState("");
  const [builderShortName, setBuilderShortName] = useState("");
  const [builderDescription, setBuilderDescription] = useState("");
  const [selectedRuleKeys, setSelectedRuleKeys] = useState<string[]>([]);

  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [result, setResult] = useState<PremarketResultResponse | null>(null);
  const [resultLoading, setResultLoading] = useState(true);
  const [startPending, setStartPending] = useState(false);
  const [stopPending, setStopPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeStrategies = useMemo(
    () => strategies.filter((s) => s.active),
    [strategies],
  );

  const reloadCatalog = useCallback(async () => {
    if (useMock) {
      setStrategies([]);
      setRules([]);
      setCatalogLoading(false);
      return;
    }
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
  }, [useMock]);

  const loadResult = useCallback(async (runId?: string | null) => {
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
    setSelectedRuleKeys([]);
    setCatalogError(null);
  }, []);

  const loadStrategyForEdit = useCallback((strategy: DynamicStrategy) => {
    setEditingStrategyId(strategy.id);
    setBuilderName(strategy.name);
    setBuilderShortName(strategy.shortName ?? "");
    setBuilderDescription(strategy.description ?? "");
    setSelectedRuleKeys(strategy.rules.map((r) => r.ruleKey));
    setCatalogError(null);
    setNotice(`Editing "${strategy.name}" — change rules and click Update strategy.`);
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
      const payload = {
        name,
        shortName: builderShortName.trim() || undefined,
        description: builderDescription.trim() || undefined,
        ruleKeys: selectedRuleKeys,
        active: true,
      };
      const wasEdit = editingStrategyId != null;
      const saved = wasEdit
        ? await patchDynamicStrategy(editingStrategyId, payload)
        : await createDynamicStrategy(payload);
      clearBuilder();
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

  const startEvaluate = useCallback(
    async (mode: "strategies" | "rules" = "strategies") => {
      setStartPending(true);
      setError(null);
      setNotice(null);
      try {
        if (mode === "rules") {
          if (selectedRuleKeys.length === 0) {
            setError("Add at least one rule in the builder to preview.");
            return;
          }
          const payload = await postDynamicEvaluate({ ruleKeys: selectedRuleKeys });
          setResult(payload);
          setNotice(payload.message ?? "Preview evaluate complete.");
          return;
        }

        const ids = activeStrategies.map((s) => s.id);
        if (ids.length === 0) {
          setError("No active strategies — activate a saved strategy first.");
          return;
        }
        const payload = await postDynamicEvaluate({ strategyIds: ids });
        setResult(payload);
        setNotice(payload.message ?? "Evaluate complete.");
      } catch (err) {
        setError(resolveError(err));
      } finally {
        setStartPending(false);
      }
    },
    [activeStrategies, selectedRuleKeys],
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

  return {
    useMock,
    strategies,
    rules,
    activeStrategies,
    editingStrategyId,
    builderName,
    builderShortName,
    builderDescription,
    selectedRuleKeys,
    setBuilderName,
    setBuilderShortName,
    setBuilderDescription,
    addRuleToBuilder,
    removeRuleFromBuilder,
    moveRuleInBuilder,
    clearBuilder,
    loadStrategyForEdit,
    saveBuilder,
    toggleStrategyActive,
    reloadCatalog,
    catalogLoading,
    catalogSaving,
    catalogError,
    result,
    loading: catalogLoading || resultLoading,
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
