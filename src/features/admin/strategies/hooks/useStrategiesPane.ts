import { useCallback, useEffect, useState } from "react";
import {
  buildRulesPayload,
  builderRowsFromStrategyRules,
  moveBuilderRow,
  newBuilderRow,
  removeBuilderRow,
  setRowOperation,
  setRowTrend,
  setRowType,
  type BuilderRuleRow,
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
  type RuleOperationValue,
  type RuleTrendValue,
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
  const [builderRows, setBuilderRows] = useState<BuilderRuleRow[]>([]);

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
    setBuilderRows([]);
    setError(null);
    setNotice(null);
  }, []);

  const resetBuilder = useCallback(() => {
    clearBuilder();
  }, [clearBuilder]);

  const hydrateBuilderFromStrategy = useCallback((strategy: DynamicStrategy) => {
    setEditingStrategyId(strategy.id);
    setBuilderName(strategy.name);
    setBuilderShortName(strategy.shortName ?? "");
    setBuilderDescription(strategy.description ?? "");
    setBuilderRows(builderRowsFromStrategyRules(strategy.rules));
    setError(null);
  }, []);

  const addRuleToBuilder = useCallback(
    (ruleKey: string) => {
      const template = rules.find((r) => r.ruleKey === ruleKey);
      setBuilderRows((prev) => [...prev, newBuilderRow(ruleKey, template)]);
    },
    [rules],
  );

  const removeRuleFromBuilder = useCallback((rowId: string) => {
    setBuilderRows((prev) => removeBuilderRow(prev, rowId));
  }, []);

  const setRuleTrend = useCallback((rowId: string, trend: RuleTrendValue) => {
    setBuilderRows((prev) => setRowTrend(prev, rowId, trend));
  }, []);

  const setRuleOperation = useCallback((rowId: string, operation: RuleOperationValue) => {
    setBuilderRows((prev) => setRowOperation(prev, rowId, operation));
  }, []);

  const setRuleType = useCallback((rowId: string, ruleType: RuleType) => {
    setBuilderRows((prev) => setRowType(prev, rowId, ruleType));
  }, []);

  const moveRuleInBuilder = useCallback((rowId: string, direction: "up" | "down") => {
    setBuilderRows((prev) => moveBuilderRow(prev, rowId, direction));
  }, []);

  const saveBuilder = useCallback(async () => {
    const name = builderName.trim();
    if (!name || builderRows.length === 0) {
      setError("Name and at least one rule are required.");
      return null;
    }
    setSaving(true);
    setError(null);
    try {
      const wasEdit = editingStrategyId != null;
      const payload = {
        name,
        shortName: builderShortName.trim(),
        description: builderDescription.trim(),
        rules: buildRulesPayload(builderRows),
        active: true,
      };
      const saved = wasEdit
        ? await patchDynamicStrategy(editingStrategyId, payload)
        : await createDynamicStrategy(payload);
      clearBuilder();
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
    builderName,
    builderRows,
    builderShortName,
    clearBuilder,
    editingStrategyId,
    reload,
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
          clearBuilder();
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
    [clearBuilder, editingStrategyId, reload],
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
          clearBuilder();
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
    [clearBuilder, editingStrategyId, reload],
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
          clearBuilder();
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
    [clearBuilder, editingStrategyId, reload],
  );

  const previewBuilder = useCallback(async () => {
    if (builderRows.length === 0) {
      setError("Add at least one rule to preview.");
      return;
    }
    setPreviewPending(true);
    setError(null);
    setNotice(null);
    try {
      const payload = await postDynamicEvaluate({
        rules: buildRulesPayload(builderRows),
        assessmentTimeMode: "now",
        options: { signalThresholdPct: 50 },
      });
      setNotice(payload.message ?? "Preview evaluate complete. Open Premarket for full results.");
    } catch (err) {
      setError(resolveError(err));
    } finally {
      setPreviewPending(false);
    }
  }, [builderRows]);

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
    builderRows,
    loading,
    saving,
    previewPending,
    error,
    notice,
    setBuilderName,
    setBuilderShortName,
    setBuilderDescription,
    setRuleTrend,
    setRuleOperation,
    setRuleType,
    addRuleToBuilder,
    removeRuleFromBuilder,
    moveRuleInBuilder,
    resetBuilder,
    hydrateBuilderFromStrategy,
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
