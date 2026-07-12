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
  suggestNextStrategyId,
  type BuilderRuleRow,
} from "@/features/premarket/lib/builder-utils";
import { evalDedupeKey } from "@/shared/lib/rule-dedupe";
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

function sortStrategies(rows: DynamicStrategy[]): DynamicStrategy[] {
  return [...rows].sort((a, b) => {
    const tierOrder = resolveStrategyTier(a) === "standard" ? 0 : 1;
    const tierOrderB = resolveStrategyTier(b) === "standard" ? 0 : 1;
    if (tierOrder !== tierOrderB) return tierOrder - tierOrderB;
    return a.name.localeCompare(b.name);
  });
}

function strategyRulesToInput(rules: DynamicStrategy["rules"]) {
  return buildRulesPayload(
    rules.map((rule) => ({
      id: rule.id,
      ruleKey: rule.ruleKey,
      type: (rule.type === "extra" || rule.type === "gate" ? rule.type : "required") as
        | "required"
        | "extra"
        | "gate",
      trend: rule.trend,
      operation: rule.operation,
    })),
  );
}

function markDirty(prev: Set<string>, id: string): Set<string> {
  const next = new Set(prev);
  next.add(id);
  return next;
}

function clearId(prev: Set<string>, id: string): Set<string> {
  if (!prev.has(id)) return prev;
  const next = new Set(prev);
  next.delete(id);
  return next;
}

export function useStrategiesPane(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;
  const useMock = dynamicStrategiesUseMock();

  const [strategies, setStrategies] = useState<DynamicStrategy[]>([]);
  const [rules, setRules] = useState<DynamicRuleTemplate[]>([]);

  const [editingStrategyId, setEditingStrategyId] = useState<string | null>(null);
  const [builderStrategyId, setBuilderStrategyId] = useState("");
  const [builderName, setBuilderName] = useState("");
  const [builderRows, setBuilderRows] = useState<BuilderRuleRow[]>([]);

  /** Strategy ids with local edits not yet written to Dynamo. */
  const [dirtyActiveIds, setDirtyActiveIds] = useState<Set<string>>(() => new Set());
  const [dirtyContentIds, setDirtyContentIds] = useState<Set<string>>(() => new Set());
  /** Local-only creates — POST on Save all instead of PATCH. */
  const [pendingCreateIds, setPendingCreateIds] = useState<Set<string>>(() => new Set());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewPending, setPreviewPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const clearPendingEdits = useCallback(() => {
    setDirtyActiveIds(new Set());
    setDirtyContentIds(new Set());
    setPendingCreateIds(new Set());
  }, []);

  const reload = useCallback(async () => {
    if (!enabled) {
      setStrategies([]);
      setRules([]);
      clearPendingEdits();
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
      const rows = sortStrategies(
        (catalog.strategies ?? []).map((row) => normalizeStrategy(row as DynamicStrategy)),
      );
      setStrategies(rows);
      setRules(rulesPayload.rules ?? []);
      clearPendingEdits();
    } catch (err) {
      setError(resolveError(err));
    } finally {
      setLoading(false);
    }
  }, [clearPendingEdits, enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const clearBuilder = useCallback(() => {
    setEditingStrategyId(null);
    setBuilderStrategyId("");
    setBuilderName("");
    setBuilderRows([]);
    setError(null);
    setNotice(null);
  }, []);

  const resetBuilder = useCallback(() => {
    clearBuilder();
    setBuilderStrategyId(suggestNextStrategyId(strategies));
  }, [clearBuilder, strategies]);

  const cloneBuilderFromStrategy = useCallback(
    (source: DynamicStrategy) => {
      setEditingStrategyId(null);
      setBuilderName(`${source.name} (copy)`);
      setBuilderStrategyId(suggestNextStrategyId(strategies));
      setBuilderRows(builderRowsFromStrategyRules(source.rules));
      setError(null);
      setNotice(`Loaded rules from ${source.id}. Set a new ID before saving.`);
    },
    [strategies],
  );

  const hydrateBuilderFromStrategy = useCallback((strategy: DynamicStrategy) => {
    setEditingStrategyId(strategy.id);
    setBuilderStrategyId(strategy.id);
    setBuilderName(strategy.name);
    setBuilderRows(builderRowsFromStrategyRules(strategy.rules));
    setError(null);
  }, []);

  const addRuleToBuilder = useCallback(
    (ruleKey: string) => {
      const template = rules.find((r) => r.ruleKey === ruleKey);
      if (template?.trend === "auto" && template?.operation === "auto") {
        setBuilderRows((prev) => {
          const dedupeKey = evalDedupeKey({ ruleKey });
          if (prev.some((row) => evalDedupeKey(row) === dedupeKey)) {
            setNotice(
              `"${template.label}" only needs one row — direction is detected automatically.`,
            );
            return prev;
          }
          return [...prev, newBuilderRow(ruleKey, template)];
        });
        return;
      }
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

  const saveBuilder = useCallback(async (options?: { stayOnPage?: boolean }) => {
    const name = builderName.trim();
    const id = builderStrategyId.trim();
    if (!name || builderRows.length === 0) {
      setError("Name and at least one rule are required.");
      return null;
    }
    if (!editingStrategyId && !id) {
      setError("Strategy ID is required (e.g. E01).");
      return null;
    }
    setError(null);

    const wasEdit = editingStrategyId != null;
    const strategyId = wasEdit ? editingStrategyId : id;
    if (!wasEdit && strategies.some((row) => row.id === strategyId)) {
      setError(`Strategy already exists: ${strategyId}`);
      return null;
    }

    const ruleInputs = buildRulesPayload(builderRows);
    const existing = wasEdit ? strategies.find((row) => row.id === strategyId) : undefined;
    const staged = normalizeStrategy({
      id: strategyId,
      name,
      shortName: existing?.shortName,
      description: existing?.description,
      tier: existing?.tier ?? "dynamic",
      direction: existing?.direction,
      active: true,
      rules: ruleInputs.map((rule, index) => {
        const prior = existing?.rules.find((row) => row.id === rule.id);
        const template = rules.find((r) => r.ruleKey === rule.ruleKey);
        return {
          id: rule.id ?? prior?.id ?? `${strategyId}-${rule.ruleKey}-${index}`,
          ruleKey: rule.ruleKey,
          label: prior?.label ?? template?.label ?? rule.ruleKey,
          type: rule.type ?? "required",
          timeframe: prior?.timeframe ?? template?.timeframe,
          trend: rule.trend,
          operation: rule.operation,
          pathVariant: rule.pathVariant,
          when: prior?.when ?? template?.when,
        };
      }),
    });

    setStrategies((prev) => {
      if (wasEdit) {
        return sortStrategies(prev.map((row) => (row.id === strategyId ? staged : row)));
      }
      return sortStrategies([...prev, staged]);
    });
    setDirtyContentIds((prev) => markDirty(prev, strategyId));
    if (!wasEdit) {
      setPendingCreateIds((prev) => markDirty(prev, strategyId));
    }

    if (options?.stayOnPage) {
      hydrateBuilderFromStrategy(staged);
    } else {
      clearBuilder();
    }
    setNotice(
      wasEdit
        ? `Strategy "${staged.name}" updated locally — click Save all to persist.`
        : `Strategy "${staged.name}" staged locally — click Save all to persist.`,
    );
    return staged;
  }, [
    builderName,
    builderRows,
    builderStrategyId,
    clearBuilder,
    editingStrategyId,
    hydrateBuilderFromStrategy,
    rules,
    strategies,
  ]);

  const toggleStrategyActive = useCallback((strategy: DynamicStrategy) => {
    const tier = resolveStrategyTier(strategy);
    const nextActive = !strategy.active;
    setStrategies((prev) =>
      prev.map((row) => (row.id === strategy.id ? { ...row, active: nextActive } : row)),
    );
    setDirtyActiveIds((prev) => markDirty(prev, strategy.id));
    setError(null);
    setNotice(
      `${strategy.name} ${nextActive ? "activated" : "deactivated"} for ${evaluateSurfaceLabel(tier)} (unsaved).`,
    );
  }, []);

  const saveAllStrategies = useCallback(
    async (options?: { extra?: DynamicStrategy; extraIsCreate?: boolean }) => {
      const ids = new Set<string>([
        ...dirtyActiveIds,
        ...dirtyContentIds,
        ...pendingCreateIds,
      ]);
      if (options?.extra) {
        ids.add(options.extra.id);
      }
      if (ids.size === 0) {
        setNotice("No unsaved strategy changes.");
        return true;
      }
      setSaving(true);
      setError(null);
      try {
        for (const id of ids) {
          const strategy =
            options?.extra?.id === id
              ? options.extra
              : strategies.find((row) => row.id === id);
          if (!strategy) continue;
          const isCreate = pendingCreateIds.has(id) || (options?.extraIsCreate === true && options.extra?.id === id);
          if (isCreate) {
            await createDynamicStrategy({
              id: strategy.id,
              name: strategy.name,
              shortName: strategy.shortName ?? undefined,
              description: strategy.description,
              direction: strategy.direction ?? undefined,
              active: strategy.active,
              rules: strategyRulesToInput(strategy.rules),
            });
          } else if (dirtyContentIds.has(id) || options?.extra?.id === id) {
            await patchDynamicStrategy(id, {
              name: strategy.name,
              active: strategy.active,
              rules: strategyRulesToInput(strategy.rules),
            });
          } else {
            await patchDynamicStrategy(id, { active: strategy.active });
          }
        }
        await reload();
        setNotice(`Saved ${ids.size} strateg${ids.size === 1 ? "y" : "ies"} to Dynamo.`);
        return true;
      } catch (err) {
        setError(resolveError(err));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [dirtyActiveIds, dirtyContentIds, pendingCreateIds, reload, strategies],
  );

  const deleteStrategy = useCallback(
    async (strategy: DynamicStrategy) => {
      const tier = resolveStrategyTier(strategy);
      if (tier === "standard") {
        setError("Standard playbooks cannot be deleted. Demote to dynamic or deactivate instead.");
        return false;
      }

      const isPendingCreate = pendingCreateIds.has(strategy.id);
      const ok = window.confirm(
        isPendingCreate
          ? `Discard unsaved strategy "${strategy.name}"?`
          : `Delete "${strategy.name}"?\n\nThis permanently removes the strategy from Dynamo. It will no longer appear in Premarket evaluate.`,
      );
      if (!ok) return false;

      if (isPendingCreate) {
        setStrategies((prev) => prev.filter((row) => row.id !== strategy.id));
        setDirtyActiveIds((prev) => clearId(prev, strategy.id));
        setDirtyContentIds((prev) => clearId(prev, strategy.id));
        setPendingCreateIds((prev) => clearId(prev, strategy.id));
        if (editingStrategyId === strategy.id) {
          clearBuilder();
        }
        setNotice(`Unsaved strategy "${strategy.name}" discarded.`);
        return true;
      }

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
    [clearBuilder, editingStrategyId, pendingCreateIds, reload],
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
  const dirtyIds = new Set<string>([...dirtyActiveIds, ...dirtyContentIds, ...pendingCreateIds]);
  const dirtyCount = dirtyIds.size;
  const hasUnsavedChanges = dirtyCount > 0;

  return {
    useMock,
    strategies,
    standardStrategies,
    dynamicStrategies,
    rules,
    editingStrategyId,
    builderStrategyId,
    builderName,
    builderRows,
    loading,
    saving,
    previewPending,
    error,
    notice,
    dirtyIds,
    dirtyCount,
    hasUnsavedChanges,
    setBuilderStrategyId,
    setBuilderName,
    setRuleTrend,
    setRuleOperation,
    setRuleType,
    addRuleToBuilder,
    removeRuleFromBuilder,
    moveRuleInBuilder,
    resetBuilder,
    hydrateBuilderFromStrategy,
    cloneBuilderFromStrategy,
    saveBuilder,
    saveAllStrategies,
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
