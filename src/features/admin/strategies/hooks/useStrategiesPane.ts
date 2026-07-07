import { useCallback, useEffect, useState } from "react";
import {
  buildRulesPayload,
  normalizeRuleType,
  pathVariantsFromStrategyRules,
  ruleTypesFromStrategyRules,
} from "@/features/premarket/lib/builder-utils";
import {
  DynamicStrategyApiError,
  createDynamicStrategy,
  deleteDynamicStrategy,
  demoteDynamicStrategy,
  fetchDynamicCatalog,
  fetchDynamicRules,
  patchDynamicStrategy,
  postDynamicEvaluate,
  promoteDynamicStrategy,
  dynamicStrategiesUseMock,
  resolveStrategyTier,
  type DynamicRuleTemplate,
  type DynamicStrategy,
  type RulePathVariant,
  type RuleType,
  type StrategyTier,
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

function normalizeStrategy(row: DynamicStrategy): DynamicStrategy {
  return {
    ...row,
    tier: resolveStrategyTier(row),
    active: row.active !== false,
    rules: row.rules ?? [],
  };
}

function evaluateSurfaceLabel(tier: StrategyTier): string {
  return tier === "standard" ? "Market" : "Premarket";
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
  const [rulePathVariants, setRulePathVariants] = useState<Record<string, RulePathVariant>>({});
  const [ruleTypes, setRuleTypes] = useState<Record<string, RuleType>>({});
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
      const rows = (catalog.strategies ?? []).map((row) => normalizeStrategy(row as DynamicStrategy));
      rows.sort((a, b) => {
        const tierOrder = resolveStrategyTier(a) === "standard" ? 0 : 1;
        const tierOrderB = resolveStrategyTier(b) === "standard" ? 0 : 1;
        if (tierOrder !== tierOrderB) return tierOrder - tierOrderB;
        return a.name.localeCompare(b.name);
      });
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
    setRulePathVariants({});
    setRuleTypes({});
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
    setRulePathVariants(pathVariantsFromStrategyRules(strategy.rules));
    setRuleTypes(ruleTypesFromStrategyRules(strategy.rules));
    setError(null);
    setBuilderOpen(true);
  }, []);

  const addRuleToBuilder = useCallback((ruleKey: string) => {
    setSelectedRuleKeys((prev) => (prev.includes(ruleKey) ? prev : [...prev, ruleKey]));
    setRuleTypes((prev) => {
      if (prev[ruleKey]) return prev;
      const template = rules.find((r) => r.ruleKey === ruleKey);
      return { ...prev, [ruleKey]: normalizeRuleType(template?.defaultType) };
    });
  }, [rules]);

  const removeRuleFromBuilder = useCallback((ruleKey: string) => {
    setSelectedRuleKeys((prev) => prev.filter((k) => k !== ruleKey));
    setRulePathVariants((prev) => {
      const next = { ...prev };
      delete next[ruleKey];
      return next;
    });
    setRuleTypes((prev) => {
      const next = { ...prev };
      delete next[ruleKey];
      return next;
    });
  }, []);

  const setRulePathVariant = useCallback((ruleKey: string, path: RulePathVariant) => {
    setRulePathVariants((prev) => {
      const next = { ...prev };
      if (path === "CALL" || path === "PUT") {
        next[ruleKey] = path;
      } else {
        delete next[ruleKey];
      }
      return next;
    });
  }, []);

  const setRuleType = useCallback((ruleKey: string, ruleType: RuleType) => {
    setRuleTypes((prev) => ({ ...prev, [ruleKey]: ruleType }));
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
        shortName: builderShortName.trim(),
        description: builderDescription.trim(),
        ...directionPayload,
        rules: buildRulesPayload(selectedRuleKeys, rulePathVariants, ruleTypes),
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
      return normalizeStrategy(saved);
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
    rulePathVariants,
    ruleTypes,
    selectedRuleKeys,
  ]);

  const toggleStrategyActive = useCallback(
    async (strategy: DynamicStrategy) => {
      const tier = resolveStrategyTier(strategy);
      setSaving(true);
      setError(null);
      try {
        await patchDynamicStrategy(strategy.id, { active: !strategy.active });
        await reload();
        setNotice(
          `${strategy.name} ${!strategy.active ? "activated" : "deactivated"} for ${evaluateSurfaceLabel(tier)}.`,
        );
      } catch (err) {
        setError(resolveError(err));
      } finally {
        setSaving(false);
      }
    },
    [reload],
  );

  const deleteStrategy = useCallback(
    async (strategy: DynamicStrategy) => {
      const tier = resolveStrategyTier(strategy);
      if (tier === "standard") {
        setError("Standard playbooks cannot be deleted. Demote to dynamic or deactivate instead.");
        return false;
      }
      const ok = window.confirm(
        `Delete "${strategy.name}"?\n\nThis permanently removes the strategy from Dynamo. It will no longer appear in Premarket evaluate.`,
      );
      if (!ok) return false;

      setSaving(true);
      setError(null);
      try {
        await deleteDynamicStrategy(strategy.id);
        if (editingStrategyId === strategy.id) {
          closeBuilder();
        }
        await reload();
        setNotice(`Strategy "${strategy.name}" deleted.`);
        return true;
      } catch (err) {
        setError(resolveError(err));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [closeBuilder, editingStrategyId, reload],
  );

  const deleteEditingStrategy = useCallback(async () => {
    if (!editingStrategyId) return false;
    const strategy = strategies.find((row) => row.id === editingStrategyId);
    if (!strategy) {
      setError("Strategy no longer in catalog — refresh and try again.");
      return false;
    }
    return deleteStrategy(strategy);
  }, [deleteStrategy, editingStrategyId, strategies]);

  const promoteStrategy = useCallback(
    async (strategy: DynamicStrategy) => {
      const ok = window.confirm(
        `Promote "${strategy.name}" to standard?\n\nIt will evaluate on Market (not Premarket) and keep the same id.`,
      );
      if (!ok) return false;

      setSaving(true);
      setError(null);
      try {
        const saved = await promoteDynamicStrategy(strategy.id);
        if (editingStrategyId === strategy.id) {
          closeBuilder();
        }
        await reload();
        setNotice(`"${saved.name}" promoted to standard — active for Market evaluate.`);
        return true;
      } catch (err) {
        setError(resolveError(err));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [closeBuilder, editingStrategyId, reload],
  );

  const demoteStrategy = useCallback(
    async (strategy: DynamicStrategy) => {
      const ok = window.confirm(
        `Demote "${strategy.name}" to dynamic?\n\nA new Premarket copy is created; the standard playbook is deactivated.`,
      );
      if (!ok) return false;

      setSaving(true);
      setError(null);
      try {
        const saved = await demoteDynamicStrategy(strategy.id);
        if (editingStrategyId === strategy.id) {
          closeBuilder();
        }
        await reload();
        setNotice(`"${saved.name}" demoted — standard deactivated, dynamic copy saved for Premarket.`);
        return true;
      } catch (err) {
        setError(resolveError(err));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [closeBuilder, editingStrategyId, reload],
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
        rules: buildRulesPayload(selectedRuleKeys, rulePathVariants, ruleTypes),
        assessmentTimeMode: "now",
        options: { signalThresholdPct: 50 },
        ...(builderDirection ? { direction: builderDirection } : {}),
      });
      setNotice(payload.message ?? "Preview evaluate complete. Open Premarket for full results.");
    } catch (err) {
      setError(resolveError(err));
    } finally {
      setPreviewPending(false);
    }
  }, [builderDirection, rulePathVariants, ruleTypes, selectedRuleKeys]);

  const standardStrategies = strategies.filter((s) => resolveStrategyTier(s) === "standard");
  const dynamicStrategies = strategies.filter((s) => resolveStrategyTier(s) === "dynamic");

  return {
    useMock,
    strategies,
    standardStrategies,
    dynamicStrategies,
    rules,
    editingStrategyId,
    builderName,
    builderShortName,
    builderDescription,
    builderDirection,
    selectedRuleKeys,
    rulePathVariants,
    ruleTypes,
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
    setRulePathVariant,
    setRuleType,
    addRuleToBuilder,
    removeRuleFromBuilder,
    moveRuleInBuilder,
    closeBuilder,
    openBuilderForNew,
    loadStrategyForEdit,
    saveBuilder,
    toggleStrategyActive,
    deleteStrategy,
    deleteEditingStrategy,
    promoteStrategy,
    demoteStrategy,
    previewBuilder,
    reload,
    resolveStrategyTier,
  };
}
