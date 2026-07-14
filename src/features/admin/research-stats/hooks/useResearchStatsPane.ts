import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchDynamicCatalog,
  fetchDynamicRules,
  resolveStrategyTier,
  type DynamicRuleTemplate,
  type DynamicStrategy,
} from "@/features/premarket/api/dynamic-strategy-client";
import { normalizeTimeframe } from "@/features/premarket/lib/builder-utils";
import {
  researchStatsApiBaseUrl,
  researchStatsUsesMock,
  runResearchStats,
} from "../api/research-stats-client";
import type {
  ResearchMovementDirection,
  ResearchRuleSelection,
  ResearchScopeMode,
  ResearchStatsRequest,
  ResearchStatsResult,
  ResearchTimeframe,
} from "../types";

function todayEtDateInput(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function daysAgoEtDateInput(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function defaultMovementFromTrend(
  trend: "up" | "down" | "lateral" | undefined,
): ResearchMovementDirection {
  return trend === "down" ? "down" : "up";
}

function templateNeedsTrend(tpl: DynamicRuleTemplate | undefined): boolean {
  return tpl?.trend === "set" || tpl?.trend === "auto";
}

function templateNeedsOperation(tpl: DynamicRuleTemplate | undefined): boolean {
  return tpl?.operation === "set" || tpl?.operation === "auto";
}

export function useResearchStatsPane() {
  const useMock = researchStatsUsesMock();
  const apiBase = researchStatsApiBaseUrl();

  const [name, setName] = useState("Research 1");
  const [symbol, setSymbol] = useState("AAPL");
  const [startDate, setStartDate] = useState(() => daysAgoEtDateInput(10));
  const [endDate, setEndDate] = useState(() => todayEtDateInput());
  const [timeframe, setTimeframe] = useState<ResearchTimeframe>("1h");
  const [mode, setMode] = useState<ResearchScopeMode>("strategy");
  const [strategyId, setStrategyId] = useState("");
  const [selectedRules, setSelectedRules] = useState<ResearchRuleSelection[]>([]);

  const [strategies, setStrategies] = useState<DynamicStrategy[]>([]);
  const [ruleTemplates, setRuleTemplates] = useState<DynamicRuleTemplate[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchStatsResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const [catalog, rulesRes] = await Promise.all([
          fetchDynamicCatalog(),
          fetchDynamicRules(),
        ]);
        if (cancelled) return;
        const rows = (catalog.strategies ?? []).map((row) => ({
          ...row,
          tier: resolveStrategyTier(row),
          active: row.active !== false,
          rules: row.rules ?? [],
        }));
        rows.sort((a, b) => {
          const ta = a.tier === "standard" ? 0 : 1;
          const tb = b.tier === "standard" ? 0 : 1;
          if (ta !== tb) return ta - tb;
          return a.name.localeCompare(b.name);
        });
        setStrategies(rows);
        setRuleTemplates(rulesRes.rules ?? []);
        if (!strategyId && rows[0]) {
          setStrategyId(rows[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          setCatalogError(err instanceof Error ? err.message : "Failed to load catalog.");
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const templateByKey = useMemo(() => {
    const map = new Map<string, DynamicRuleTemplate>();
    for (const tpl of ruleTemplates) map.set(tpl.ruleKey, tpl);
    return map;
  }, [ruleTemplates]);

  const rulesForTimeframe = useMemo(() => {
    return ruleTemplates.filter((tpl) => {
      const tf = normalizeTimeframe(tpl.timeframe);
      if (timeframe === "D") return tf === "D";
      return tf === timeframe;
    });
  }, [ruleTemplates, timeframe]);

  const selectedStrategy = useMemo(
    () => strategies.find((s) => s.id === strategyId) ?? null,
    [strategies, strategyId],
  );

  const addRule = useCallback(
    (tpl: DynamicRuleTemplate) => {
      const trend =
        tpl.defaultTrend ??
        (templateNeedsTrend(tpl) ? ("up" as const) : undefined);
      const movement = defaultMovementFromTrend(trend);
      setSelectedRules((prev) => {
        if (prev.some((r) => r.ruleKey === tpl.ruleKey && r.movement === movement)) {
          return prev;
        }
        return [
          ...prev,
          {
            ruleKey: tpl.ruleKey,
            label: tpl.label,
            timeframe: tpl.timeframe,
            trend,
            operation: templateNeedsOperation(tpl) ? "call" : undefined,
            movement,
          },
        ];
      });
    },
    [],
  );

  const removeRule = useCallback((ruleKey: string, movement: ResearchMovementDirection) => {
    setSelectedRules((prev) =>
      prev.filter((r) => !(r.ruleKey === ruleKey && r.movement === movement)),
    );
  }, []);

  const updateRule = useCallback(
    (ruleKey: string, movement: ResearchMovementDirection, patch: Partial<ResearchRuleSelection>) => {
      setSelectedRules((prev) =>
        prev.map((r) => {
          if (r.ruleKey !== ruleKey || r.movement !== movement) return r;
          const next = { ...r, ...patch };
          if (patch.trend === "up" || patch.trend === "down") {
            next.movement = patch.trend;
          }
          return next;
        }),
      );
    },
    [],
  );

  const submit = useCallback(async () => {
    const sym = symbol.trim().toUpperCase();
    const researchName = name.trim();
    if (!researchName) {
      setError("Research name is required.");
      return;
    }
    if (!sym) {
      setError("Ticker is required.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Start and end dates are required.");
      return;
    }
    if (startDate > endDate) {
      setError("Start date must be on or before end date.");
      return;
    }
    if (mode === "strategy" && !strategyId.trim()) {
      setError("Select a strategy from the catalog.");
      return;
    }
    if (mode === "rules" && selectedRules.length === 0) {
      setError("Add at least one rule for this research.");
      return;
    }
    if (mode === "rules") {
      for (const row of selectedRules) {
        const tpl = templateByKey.get(row.ruleKey);
        if (templateNeedsTrend(tpl) && !row.trend) {
          setError(`Rule ${row.ruleKey} needs trend.`);
          return;
        }
        if (templateNeedsOperation(tpl) && !row.operation) {
          setError(`Rule ${row.ruleKey} needs operation.`);
          return;
        }
      }
    }

    const request: ResearchStatsRequest = {
      name: researchName,
      symbol: sym,
      startDate,
      endDate,
      timeframe,
      mode,
      ...(mode === "strategy"
        ? { strategyId: strategyId.trim() }
        : { rules: selectedRules }),
    };

    setLoading(true);
    setError(null);
    try {
      const next = await runResearchStats(request);
      setResult(next);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Research-Stats failed.");
    } finally {
      setLoading(false);
    }
  }, [
    name,
    symbol,
    startDate,
    endDate,
    timeframe,
    mode,
    strategyId,
    selectedRules,
    templateByKey,
  ]);

  return {
    useMock,
    apiBase,
    name,
    setName,
    symbol,
    setSymbol,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    timeframe,
    setTimeframe,
    mode,
    setMode,
    strategyId,
    setStrategyId,
    strategies,
    selectedStrategy,
    rulesForTimeframe,
    templateByKey,
    templateNeedsTrend,
    templateNeedsOperation,
    selectedRules,
    addRule,
    removeRule,
    updateRule,
    catalogLoading,
    catalogError,
    loading,
    error,
    result,
    submit,
  };
}
