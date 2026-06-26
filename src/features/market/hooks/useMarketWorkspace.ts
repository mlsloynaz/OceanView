import { useCallback, useEffect, useMemo, useState } from "react";
import { loadMarketWorkspaceData } from "../api/market-data";
import { buildRuleCards, buildStrategyCards, buildTickerCards } from "../display";
import {
  defaultAssessmentTime,
  formatAssessmentDisplay,
  isAssessmentNow,
  parseEtDatetimeLocal,
  validateAssessmentTime,
} from "../lib/assessment-time";
import type {
  CandleCoverage,
  MarketSnapshotFile,
  StrategiesCatalogFile,
  StrategyCatalogItem,
  TickerEvalResult,
} from "../types";

function resolveCoverage(snapshot: MarketSnapshotFile): CandleCoverage {
  if (snapshot.candleCoverage) return snapshot.candleCoverage;
  return {
    timezone: "America/New_York",
    earliestAt: `${snapshot.tradeDate}T09:30:00-04:00`,
    latestAt: snapshot.evaluatedAt,
  };
}

export function useMarketWorkspace() {
  const [catalog, setCatalog] = useState<StrategiesCatalogFile | null>(null);
  const [snapshot, setSnapshot] = useState<MarketSnapshotFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const [assessmentAt, setAssessmentAt] = useState<Date>(() => new Date());
  const [lastAssessedAt, setLastAssessedAt] = useState<Date | null>(null);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [assessPending, setAssessPending] = useState(false);
  const [coverageInitialized, setCoverageInitialized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadMarketWorkspaceData()
      .then((data) => {
        if (cancelled) return;
        setCatalog(data.catalog);
        setSnapshot(data.snapshot);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load market data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const candleCoverage = useMemo(
    () => (snapshot ? resolveCoverage(snapshot) : null),
    [snapshot],
  );

  useEffect(() => {
    if (!candleCoverage || coverageInitialized) return;
    const initial = defaultAssessmentTime(candleCoverage);
    setAssessmentAt(initial);
    setLastAssessedAt(initial);
    setCoverageInitialized(true);
  }, [candleCoverage, coverageInitialized]);

  const setAssessmentFromLocal = useCallback(
    (localValue: string) => {
      if (!candleCoverage) return;
      const parsed = parseEtDatetimeLocal(localValue);
      if (!parsed) {
        setAssessmentError("Invalid date or time.");
        return;
      }
      setAssessmentAt(parsed);
      setAssessmentError(validateAssessmentTime(parsed, candleCoverage));
    },
    [candleCoverage],
  );

  const resetAssessmentToNow = useCallback(() => {
    if (!candleCoverage) return;
    const now = defaultAssessmentTime(candleCoverage);
    setAssessmentAt(now);
    setAssessmentError(validateAssessmentTime(now, candleCoverage));
  }, [candleCoverage]);

  const runAssessment = useCallback(() => {
    if (!candleCoverage) return;
    const err = validateAssessmentTime(assessmentAt, candleCoverage);
    if (err) {
      setAssessmentError(err);
      return;
    }
    setAssessmentError(null);
    setAssessPending(true);
    // Mock: live API will POST /market/evaluate with simulationTimeEt
    window.setTimeout(() => {
      setLastAssessedAt(new Date(assessmentAt.getTime()));
      setAssessPending(false);
    }, 400);
  }, [assessmentAt, candleCoverage]);

  const strategies = catalog?.strategies ?? [];
  const threshold = snapshot?.signalThresholdPct ?? 50;

  const strategyCards = useMemo(() => {
    if (!catalog || !snapshot) return [];
    return buildStrategyCards(catalog.strategies, snapshot);
  }, [catalog, snapshot]);

  const tickerCards = useMemo(() => {
    if (!catalog || !snapshot) return [];
    return buildTickerCards(catalog.strategies, snapshot);
  }, [catalog, snapshot]);

  const ruleCards = useMemo(() => {
    if (!catalog || !snapshot) return [];
    return buildRuleCards(catalog.strategies, snapshot);
  }, [catalog, snapshot]);

  const filteredStrategyCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return strategyCards;
    return strategyCards.filter(
      (card) =>
        card.strategy.name.toLowerCase().includes(q) ||
        card.strategy.id.toLowerCase().includes(q),
    );
  }, [strategyCards, search]);

  const filteredTickerCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tickerCards;
    return tickerCards.filter(
      (card) =>
        card.symbol.toLowerCase().includes(q) ||
        (card.name?.toLowerCase().includes(q) ?? false),
    );
  }, [tickerCards, search]);

  const filteredRuleCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ruleCards;
    return ruleCards.filter(
      (card) =>
        card.label.toLowerCase().includes(q) ||
        card.ruleKey.toLowerCase().includes(q) ||
        card.strategyName.toLowerCase().includes(q),
    );
  }, [ruleCards, search]);

  const selectedStrategy = useMemo(
    () => strategies.find((s) => s.id === selectedStrategyId) ?? null,
    [strategies, selectedStrategyId],
  );

  const selectedTickerResult = useMemo((): TickerEvalResult | null => {
    if (!selectedTicker || !snapshot) return null;
    return snapshot.results.find((t) => t.symbol === selectedTicker) ?? null;
  }, [selectedTicker, snapshot]);

  const openStrategy = useCallback((strategyId: string) => {
    setSelectedStrategyId(strategyId);
    setSelectedTicker(null);
  }, []);

  const openTicker = useCallback((symbol: string) => {
    setSelectedTicker(symbol);
    setSelectedStrategyId(null);
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedStrategyId(null);
    setSelectedTicker(null);
  }, []);

  const activeSignalCount = useMemo(() => {
    if (!snapshot) return 0;
    let count = 0;
    for (const ticker of snapshot.results) {
      for (const s of ticker.strategies) {
        if (s.qualityPct >= threshold) count += 1;
      }
    }
    return count;
  }, [snapshot, threshold]);

  const strategyById = useMemo(() => {
    const map = new Map<string, StrategyCatalogItem>();
    for (const s of strategies) map.set(s.id, s);
    return map;
  }, [strategies]);

  const assessmentLabel = useMemo(() => {
    const at = lastAssessedAt ?? assessmentAt;
    const prefix = isAssessmentNow(at) ? "Live" : "Assessed";
    return `${prefix} ${formatAssessmentDisplay(at)}`;
  }, [lastAssessedAt, assessmentAt]);

  return {
    loading,
    error,
    catalog,
    snapshot,
    search,
    setSearch,
    threshold,
    filteredStrategyCards,
    filteredTickerCards,
    filteredRuleCards,
    selectedStrategy,
    selectedTickerResult,
    openStrategy,
    openTicker,
    closeDetail,
    activeSignalCount,
    strategyById,
    candleCoverage,
    assessmentAt,
    assessmentError,
    assessPending,
    setAssessmentFromLocal,
    resetAssessmentToNow,
    runAssessment,
    assessmentLabel,
  };
}
