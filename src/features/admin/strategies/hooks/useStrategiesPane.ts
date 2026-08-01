import { useCallback, useEffect, useState } from "react";
import {
  buildEntryWindowPayload,
  entryWindowTimeFields,
} from "@/features/market/lib/entry-window";
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
  fetchDynamicCatalog,
  fetchDynamicRules,
  patchDynamicStrategy,
  postDynamicEvaluate,
  dynamicStrategiesUseMock,
  resolveStrategyTier,
  type DynamicRuleTemplate,
  type DynamicStrategy,
  type RuleOperationValue,
  type RuleTrendValue,
  type RuleType,
  type StrategyTier,
} from "@/features/premarket/api/dynamic-strategy-client";
import {
  peekDynamicCatalogCache,
  peekDynamicRulesCache,
} from "@/features/premarket/api/premarket-workspace-cache";
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

const STRATEGY_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function validateStrategyId(id: string): string | null {
  if (!id) return "Strategy ID is required.";
  if (!STRATEGY_ID_RE.test(id)) {
    return "Strategy ID must be 1–64 characters: letters, digits, '.', '_', '-' (start with letter or digit).";
  }
  return null;
}

function remapPendingRename(
  prev: Record<string, string>,
  fromId: string,
  toId: string,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [stagedId, originalId] of Object.entries(prev)) {
    if (stagedId === fromId) continue;
    next[stagedId] = originalId;
  }
  const originalId = prev[fromId] ?? fromId;
  if (toId !== originalId) {
    next[toId] = originalId;
  }
  return next;
}

export function useStrategiesPane(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;
  const useMock = dynamicStrategiesUseMock();

  const [strategies, setStrategies] = useState<DynamicStrategy[]>(() => {
    const cached = peekDynamicCatalogCache();
    if (!cached?.strategies?.length) return [];
    return sortStrategies(
      cached.strategies.map((row) => normalizeStrategy(row as DynamicStrategy)),
    );
  });
  const [rules, setRules] = useState<DynamicRuleTemplate[]>(
    () => peekDynamicRulesCache()?.rules ?? [],
  );

  const [editingStrategyId, setEditingStrategyId] = useState<string | null>(null);
  const [builderStrategyId, setBuilderStrategyId] = useState("");
  const [builderName, setBuilderName] = useState("");
  const [builderEntryStart, setBuilderEntryStart] = useState("");
  const [builderEntryEnd, setBuilderEntryEnd] = useState("");
  const [builderEntryLegacyLabel, setBuilderEntryLegacyLabel] = useState<string | null>(null);
  const [builderRows, setBuilderRows] = useState<BuilderRuleRow[]>([]);
  const [builderBiasRuleId, setBuilderBiasRuleId] = useState("");

  /** Strategy ids with local edits not yet written to Dynamo. */
  const [dirtyActiveIds, setDirtyActiveIds] = useState<Set<string>>(() => new Set());
  const [dirtyContentIds, setDirtyContentIds] = useState<Set<string>>(() => new Set());
  /** Local-only creates — POST on Save all instead of PATCH. */
  const [pendingCreateIds, setPendingCreateIds] = useState<Set<string>>(() => new Set());
  /** Staged id → original Dynamo id when the user renamed locally. */
  const [pendingRenames, setPendingRenames] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(() => {
    if (!enabled) return false;
    return !peekDynamicCatalogCache() && !peekDynamicRulesCache();
  });
  const [saving, setSaving] = useState(false);
  const [previewPending, setPreviewPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const clearPendingEdits = useCallback(() => {
    setDirtyActiveIds(new Set());
    setDirtyContentIds(new Set());
    setPendingCreateIds(new Set());
    setPendingRenames({});
  }, []);

  const reload = useCallback(async (opts?: { force?: boolean }) => {
    if (!enabled) {
      setStrategies([]);
      setRules([]);
      clearPendingEdits();
      setLoading(false);
      return;
    }
    const hadCache = Boolean(peekDynamicCatalogCache() || peekDynamicRulesCache());
    if (!hadCache) setLoading(true);
    setError(null);
    try {
      const [catalog, rulesPayload] = await Promise.all([
        fetchDynamicCatalog(opts),
        fetchDynamicRules(opts),
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
    void reload({ force: true });
  }, [reload]);

  const clearBuilder = useCallback(() => {
    setEditingStrategyId(null);
    setBuilderStrategyId("");
    setBuilderName("");
    setBuilderEntryStart("");
    setBuilderEntryEnd("");
    setBuilderEntryLegacyLabel(null);
    setBuilderRows([]);
    setBuilderBiasRuleId("");
    setError(null);
    setNotice(null);
  }, []);

  const resetBuilder = useCallback(() => {
    clearBuilder();
    setBuilderStrategyId(suggestNextStrategyId(strategies));
  }, [clearBuilder, strategies]);

  const cloneBuilderFromStrategy = useCallback(
    (source: DynamicStrategy) => {
      const windowFields = entryWindowTimeFields(source.entryWindow);
      setEditingStrategyId(null);
      setBuilderName(`${source.name} (copy)`);
      setBuilderStrategyId(suggestNextStrategyId(strategies));
      setBuilderEntryStart(windowFields.startEt);
      setBuilderEntryEnd(windowFields.endEt);
      setBuilderEntryLegacyLabel(windowFields.legacyLabel);
      setBuilderRows(builderRowsFromStrategyRules(source.rules));
      const sourceBias = String(source.biasRuleId || "").trim();
      setBuilderBiasRuleId(
        sourceBias && source.rules.some((r) => r.id === sourceBias) ? sourceBias : "",
      );
      setError(null);
      setNotice(`Loaded rules from ${source.id}. Set a new ID before saving.`);
    },
    [strategies],
  );

  const hydrateBuilderFromStrategy = useCallback((strategy: DynamicStrategy) => {
    const windowFields = entryWindowTimeFields(strategy.entryWindow);
    setEditingStrategyId(strategy.id);
    setBuilderStrategyId(strategy.id);
    setBuilderName(strategy.name);
    setBuilderEntryStart(windowFields.startEt);
    setBuilderEntryEnd(windowFields.endEt);
    setBuilderEntryLegacyLabel(windowFields.legacyLabel);
    setBuilderRows(builderRowsFromStrategyRules(strategy.rules));
    const biasId = String(strategy.biasRuleId || "").trim();
    setBuilderBiasRuleId(
      biasId && strategy.rules.some((r) => r.id === biasId) ? biasId : "",
    );
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
    setBuilderBiasRuleId((prev) => (prev === rowId ? "" : prev));
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
    const idError = validateStrategyId(id);
    if (idError) {
      setError(idError);
      return null;
    }
    setError(null);

    const wasEdit = editingStrategyId != null;
    const previousId = wasEdit ? editingStrategyId : null;
    const strategyId = id;
    const renaming = wasEdit && previousId != null && previousId !== strategyId;

    if (
      strategies.some(
        (row) => row.id === strategyId && (!wasEdit || row.id !== previousId),
      )
    ) {
      setError(`Strategy already exists: ${strategyId}`);
      return null;
    }

    const ruleInputs = buildRulesPayload(builderRows);
    let entryWindow: DynamicStrategy["entryWindow"];
    try {
      entryWindow = buildEntryWindowPayload(builderEntryStart, builderEntryEnd);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid entry window.");
      return null;
    }
    // Preserve legacy string label when times were left empty.
    if (entryWindow == null && builderEntryLegacyLabel) {
      entryWindow = builderEntryLegacyLabel;
    }
    const existing = wasEdit && previousId
      ? strategies.find((row) => row.id === previousId)
      : undefined;
    const resolvedBias =
      builderBiasRuleId && builderRows.some((row) => row.id === builderBiasRuleId)
        ? builderBiasRuleId
        : null;
    const staged = normalizeStrategy({
      id: strategyId,
      name,
      shortName: existing?.shortName,
      description: existing?.description,
      tier: existing?.tier ?? "dynamic",
      direction: existing?.direction,
      biasRuleId: resolvedBias,
      entryWindow: entryWindow ?? null,
      active: existing?.active ?? true,
      rules: ruleInputs.map((rule, index) => {
        const prior = existing?.rules.find((row) => row.id === rule.id);
        const template = rules.find((r) => r.ruleKey === rule.ruleKey);
        const ruleId = rule.id ?? prior?.id ?? `${strategyId}-${rule.ruleKey}-${index}`;
        return {
          id: ruleId,
          ruleKey: rule.ruleKey,
          label: prior?.label ?? template?.label ?? rule.ruleKey,
          type: rule.type ?? "required",
          timeframe: prior?.timeframe ?? template?.timeframe,
          trend: rule.trend,
          operation: rule.operation,
          pathVariant: rule.pathVariant,
          when: prior?.when ?? template?.when,
          ...(resolvedBias && ruleId === resolvedBias ? { setsBias: true } : {}),
        };
      }),
    });

    setStrategies((prev) => {
      if (wasEdit && previousId) {
        const withoutOld = prev.filter((row) => row.id !== previousId);
        return sortStrategies([...withoutOld.filter((row) => row.id !== strategyId), staged]);
      }
      return sortStrategies([...prev.filter((row) => row.id !== strategyId), staged]);
    });

    if (renaming && previousId) {
      setDirtyActiveIds((prev) => markDirty(clearId(prev, previousId), strategyId));
      setDirtyContentIds((prev) => markDirty(clearId(prev, previousId), strategyId));
      setPendingCreateIds((prev) => {
        if (!prev.has(previousId)) return prev;
        return markDirty(clearId(prev, previousId), strategyId);
      });
      setPendingRenames((prev) => remapPendingRename(prev, previousId, strategyId));
      setEditingStrategyId(strategyId);
    } else {
      setDirtyContentIds((prev) => markDirty(prev, strategyId));
      if (!wasEdit) {
        setPendingCreateIds((prev) => markDirty(prev, strategyId));
      } else {
        setEditingStrategyId(strategyId);
      }
    }

    if (options?.stayOnPage) {
      hydrateBuilderFromStrategy(staged);
    } else {
      clearBuilder();
    }
    setNotice(
      renaming
        ? `Strategy renamed to "${staged.id}" locally — click Save all to persist.`
        : wasEdit
          ? `Strategy "${staged.name}" updated locally — click Save all to persist.`
          : `Strategy "${staged.name}" staged locally — click Save all to persist.`,
    );
    return staged;
  }, [
    builderBiasRuleId,
    builderEntryEnd,
    builderEntryLegacyLabel,
    builderEntryStart,
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
              biasRuleId: strategy.biasRuleId ?? null,
              entryWindow: strategy.entryWindow ?? null,
              active: strategy.active,
              rules: strategyRulesToInput(strategy.rules),
            });
          } else if (dirtyContentIds.has(id) || options?.extra?.id === id) {
            const originalId = pendingRenames[id];
            await patchDynamicStrategy(originalId ?? id, {
              ...(originalId && originalId !== id ? { newId: id } : {}),
              name: strategy.name,
              active: strategy.active,
              biasRuleId: strategy.biasRuleId ?? null,
              entryWindow: strategy.entryWindow ?? null,
              rules: strategyRulesToInput(strategy.rules),
            });
          } else {
            const originalId = pendingRenames[id];
            await patchDynamicStrategy(originalId ?? id, {
              ...(originalId && originalId !== id ? { newId: id } : {}),
              active: strategy.active,
            });
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
    [dirtyActiveIds, dirtyContentIds, pendingCreateIds, pendingRenames, reload, strategies],
  );

  const deleteStrategy = useCallback(
    async (strategy: DynamicStrategy) => {
      const isPendingCreate = pendingCreateIds.has(strategy.id);
      const dynamoId = pendingRenames[strategy.id] ?? strategy.id;
      const ok = window.confirm(
        isPendingCreate
          ? `Discard unsaved strategy "${strategy.name}"?`
          : `Delete "${strategy.name}" (${dynamoId})?\n\nThis permanently removes the strategy from Dynamo.`,
      );
      if (!ok) return false;

      if (isPendingCreate) {
        setStrategies((prev) => prev.filter((row) => row.id !== strategy.id));
        setDirtyActiveIds((prev) => clearId(prev, strategy.id));
        setDirtyContentIds((prev) => clearId(prev, strategy.id));
        setPendingCreateIds((prev) => clearId(prev, strategy.id));
        setPendingRenames((prev) => {
          if (!(strategy.id in prev)) return prev;
          const next = { ...prev };
          delete next[strategy.id];
          return next;
        });
        if (editingStrategyId === strategy.id) {
          clearBuilder();
        }
        setNotice(`Unsaved strategy "${strategy.name}" discarded.`);
        return true;
      }

      setSaving(true);
      setError(null);
      try {
        await deleteDynamicStrategy(dynamoId);
        if (editingStrategyId === strategy.id || editingStrategyId === dynamoId) {
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
    [clearBuilder, editingStrategyId, pendingCreateIds, pendingRenames, reload],
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

  const renameStrategy = useCallback(
    async (strategy: DynamicStrategy, nextIdRaw?: string) => {
      const dynamoId = pendingRenames[strategy.id] ?? strategy.id;
      const suggested = nextIdRaw?.trim() || strategy.id;
      const entered = window.prompt(
        `Rename strategy id\n\nCurrent: ${dynamoId}\n\nEnter the new id (letters, digits, '.', '_', '-', max 64):`,
        suggested,
      );
      if (entered == null) return false;
      const nextId = entered.trim();
      const idError = validateStrategyId(nextId);
      if (idError) {
        setError(idError);
        return false;
      }
      if (nextId === dynamoId) {
        setNotice("Strategy id unchanged.");
        return true;
      }
      if (strategies.some((row) => row.id === nextId && row.id !== strategy.id)) {
        setError(`Strategy already exists: ${nextId}`);
        return false;
      }

      setSaving(true);
      setError(null);
      try {
        await patchDynamicStrategy(dynamoId, { newId: nextId });
        if (editingStrategyId === strategy.id || editingStrategyId === dynamoId) {
          clearBuilder();
        }
        await reload();
        setNotice(`Strategy renamed to "${nextId}".`);
        return true;
      } catch (err) {
        setError(resolveError(err));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [clearBuilder, editingStrategyId, pendingRenames, reload, strategies],
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
  const builderIdDirty =
    editingStrategyId != null &&
    builderStrategyId.trim().length > 0 &&
    builderStrategyId.trim() !== editingStrategyId;

  return {
    useMock,
    strategies,
    standardStrategies,
    dynamicStrategies,
    rules,
    editingStrategyId,
    builderStrategyId,
    builderName,
    builderEntryStart,
    builderEntryEnd,
    builderEntryLegacyLabel,
    builderRows,
    builderBiasRuleId,
    loading,
    saving,
    previewPending,
    error,
    notice,
    dirtyIds,
    dirtyCount,
    hasUnsavedChanges,
    builderIdDirty,
    setBuilderStrategyId,
    setBuilderName,
    setBuilderEntryStart,
    setBuilderEntryEnd,
    setBuilderBiasRuleId,
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
    renameStrategy,
    previewBuilder,
    reload,
    resolveStrategyTier,
  };
}
