import { useCallback, useEffect, useState } from "react";
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
} from "@/features/premarket/api/dynamic-strategy-client";
import { PREMARKET_ERROR_MESSAGES } from "@/features/premarket/api/premarket-client";

function resolveError(err: unknown): string {
  if (err instanceof DynamicStrategyApiError) {
    const code = err.code;
    if (code && PREMARKET_ERROR_MESSAGES[code]) {
      return PREMARKET_ERROR_MESSAGES[code];
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Strategy request failed.";
}

export function useStrategiesPane(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;
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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewPending, setPreviewPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      setStrategies([]);
      setRules([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
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
      setError(resolveError(err));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const clearBuilder = useCallback(() => {
    setEditingStrategyId(null);
    setBuilderName("");
    setBuilderShortName("");
    setBuilderDescription("");
    setBuilderDirection("");
    setSelectedRuleKeys([]);
    setError(null);
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
    setError(null);
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
      setError("Name and at least one rule are required.");
      return null;
    }
    setSaving(true);
    setError(null);
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
      await reload();
      setNotice(
        wasEdit
          ? `Strategy "${saved.name}" updated.`
          : `Strategy "${saved.name}" saved to Dynamo.`,
      );
      return saved;
    } catch (err) {
      setError(resolveError(err));
      return null;
    } finally {
      setSaving(false);
    }
  }, [
    builderDescription,
    builderDirection,
    builderName,
    builderShortName,
    clearBuilder,
    editingStrategyId,
    reload,
    selectedRuleKeys,
  ]);

  const toggleStrategyActive = useCallback(
    async (strategy: DynamicStrategy) => {
      setSaving(true);
      setError(null);
      try {
        await patchDynamicStrategy(strategy.id, { active: !strategy.active });
        await reload();
      } catch (err) {
        setError(resolveError(err));
      } finally {
        setSaving(false);
      }
    },
    [reload],
  );

  const previewBuilder = useCallback(async () => {
    if (selectedRuleKeys.length === 0) {
      setError("Add at least one rule to preview.");
      return;
    }
    setPreviewPending(true);
    setError(null);
    setNotice(null);
    try {
      const payload = await postDynamicEvaluate({
        ruleKeys: selectedRuleKeys,
        assessmentTimeMode: "now",
        options: { signalThresholdPct: 50 },
      });
      setNotice(payload.message ?? "Preview evaluate complete. Open Premarket for full results.");
    } catch (err) {
      setError(resolveError(err));
    } finally {
      setPreviewPending(false);
    }
  }, [selectedRuleKeys]);

  return {
    useMock,
    strategies,
    rules,
    editingStrategyId,
    builderName,
    builderShortName,
    builderDescription,
    builderDirection,
    selectedRuleKeys,
    builderOpen,
    loading,
    saving,
    previewPending,
    error,
    notice,
    setBuilderName,
    setBuilderShortName,
    setBuilderDescription,
    setBuilderDirection,
    addRuleToBuilder,
    removeRuleFromBuilder,
    moveRuleInBuilder,
    closeBuilder,
    openBuilderForNew,
    loadStrategyForEdit,
    saveBuilder,
    toggleStrategyActive,
    previewBuilder,
    reload,
  };
}
