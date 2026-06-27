import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadMarketBootstrap,
  loadMarketWorkspaceDataMock,
  loadSnapshotForModeWithCatalog,
  marketDataUsesMock,
} from "../api/market-data";
import {
  MARKET_ERROR_MESSAGES,
  MarketApiError,
  fetchMarketEnvelope,
  postMarketEvaluate,
} from "../api/market-client";
import { buildRuleCards, buildStrategyCards, buildTickerCards } from "../display";
import {
  defaultAssessmentTime,
  formatAssessmentDisplay,
  formatSimulationTimeEt,
  isAssessmentNow,
  parseEtDatetimeLocal,
  parseSimulationTimeEt,
  validateAssessmentTime,
} from "../lib/assessment-time";
import type {
  CandleCoverage,
  MarketEnvelope,
  MarketSnapshotFile,
  MarketViewMode,
  RuleCardModel,
  StrategiesCatalogFile,
  StrategyCatalogItem,
  StrategyCardModel,
  TickerCardModel,
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

type SnapshotCache = Partial<
  Record<
    MarketViewMode,
    {
      strategyCards?: StrategyCardModel[];
      tickerCards?: TickerCardModel[];
      ruleCards?: RuleCardModel[];
    }
  >
>;

export function useMarketWorkspace(viewMode: MarketViewMode) {
  const useMock = marketDataUsesMock();

  const [catalog, setCatalog] = useState<StrategiesCatalogFile | null>(null);
  const [snapshot, setSnapshot] = useState<MarketSnapshotFile | null>(null);
  const [envelope, setEnvelope] = useState<MarketEnvelope | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshotCache, setSnapshotCache] = useState<SnapshotCache>({});
  const [snapshotLoading, setSnapshotLoading] = useState(false);

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

  const catalogRef = useRef<StrategiesCatalogFile | null>(null);
  catalogRef.current = catalog;
  const snapshotCacheRef = useRef(snapshotCache);
  snapshotCacheRef.current = snapshotCache;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = useMock
      ? loadMarketWorkspaceDataMock().then((data) => {
          if (cancelled) return;
          setCatalog(data.catalog);
          setSnapshot(data.snapshot);
          setEnvelope(null);
          setRunId(null);
          setSnapshotCache({});
        })
      : loadMarketBootstrap().then((data) => {
          if (cancelled) return;
          setCatalog(data.catalog);
          setEnvelope(data.envelope);
          setRunId(data.envelope.runId);
          setSnapshot(null);
          setSnapshotCache({});
          const sim = parseSimulationTimeEt(data.envelope.simulationTimeEt);
          if (sim) setLastAssessedAt(sim);
        });

    void load
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
  }, [useMock]);

  const candleCoverage = useMemo((): CandleCoverage | null => {
    if (useMock && snapshot) return resolveCoverage(snapshot);
    if (envelope?.candleCoverage) return envelope.candleCoverage;
    return null;
  }, [useMock, snapshot, envelope]);

  useEffect(() => {
    if (!candleCoverage || coverageInitialized) return;
    const initial = defaultAssessmentTime(candleCoverage);
    setAssessmentAt(initial);
    if (!lastAssessedAt) setLastAssessedAt(initial);
    setCoverageInitialized(true);
  }, [candleCoverage, coverageInitialized, lastAssessedAt]);

  const fetchSnapshot = useCallback(
    async (mode: MarketViewMode, activeRunId: string, force = false) => {
      if (useMock || !activeRunId) return;
      if (!force && snapshotCacheRef.current[mode]) return;

      const cat = catalogRef.current;
      if (!cat) return;

      setSnapshotLoading(true);
      try {
        const payload = await loadSnapshotForModeWithCatalog(mode, activeRunId, cat);
        setRunId(payload.runId);
        setSnapshotCache((prev) => ({
          ...prev,
          [mode]: {
            strategyCards: payload.strategyCards,
            tickerCards: payload.tickerCards,
            ruleCards: payload.ruleCards,
          },
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load market snapshot.");
      } finally {
        setSnapshotLoading(false);
      }
    },
    [useMock],
  );

  useEffect(() => {
    if (useMock || !runId || loading) return;
    void fetchSnapshot(viewMode, runId);
  }, [useMock, runId, viewMode, loading, fetchSnapshot]);

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

  const refreshAfterAssess = useCallback(
    async (newRunId: string, simulationTimeEt?: string | null) => {
      const env = await fetchMarketEnvelope();
      setEnvelope(env);
      setRunId(newRunId || env.runId);
      setSnapshotCache({});
      const sim = parseSimulationTimeEt(simulationTimeEt ?? env.simulationTimeEt);
      if (sim) setLastAssessedAt(sim);
      else setLastAssessedAt(new Date(assessmentAt.getTime()));

      const cat = catalogRef.current;
      if (cat && newRunId) {
        const payload = await loadSnapshotForModeWithCatalog(viewMode, newRunId, cat);
        setSnapshotCache({
          [viewMode]: {
            strategyCards: payload.strategyCards,
            tickerCards: payload.tickerCards,
            ruleCards: payload.ruleCards,
          },
        });
      }
    },
    [assessmentAt, viewMode],
  );

  const runAssessment = useCallback(() => {
    if (!candleCoverage) return;
    const err = validateAssessmentTime(assessmentAt, candleCoverage);
    if (err) {
      setAssessmentError(err);
      return;
    }

    if (useMock) {
      setAssessmentError(null);
      setAssessPending(true);
      window.setTimeout(() => {
        setLastAssessedAt(new Date(assessmentAt.getTime()));
        setAssessPending(false);
      }, 400);
      return;
    }

    setAssessmentError(null);
    setAssessPending(true);
    void postMarketEvaluate({
      simulationTimeEt: formatSimulationTimeEt(assessmentAt),
      options: { signalThresholdPct: envelope?.signalThresholdPct ?? 50 },
    })
      .then((result) => refreshAfterAssess(result.runId, formatSimulationTimeEt(assessmentAt)))
      .catch((err) => {
        if (err instanceof MarketApiError) {
          const friendly = err.code ? MARKET_ERROR_MESSAGES[err.code] : undefined;
          setAssessmentError(friendly ?? err.message);
        } else {
          setAssessmentError(err instanceof Error ? err.message : "Assessment failed.");
        }
      })
      .finally(() => setAssessPending(false));
  }, [assessmentAt, candleCoverage, envelope, refreshAfterAssess, useMock]);

  const strategies = catalog?.strategies ?? [];
  const threshold = useMock
    ? (snapshot?.signalThresholdPct ?? 50)
    : (envelope?.signalThresholdPct ?? 50);

  const strategyCards = useMemo(() => {
    if (useMock && catalog && snapshot) {
      return buildStrategyCards(catalog.strategies, snapshot);
    }
    return snapshotCache.strategies?.strategyCards ?? [];
  }, [useMock, catalog, snapshot, snapshotCache.strategies]);

  const tickerCards = useMemo(() => {
    if (useMock && catalog && snapshot) {
      return buildTickerCards(catalog.strategies, snapshot);
    }
    return snapshotCache.tickers?.tickerCards ?? [];
  }, [useMock, catalog, snapshot, snapshotCache.tickers]);

  const ruleCards = useMemo(() => {
    if (useMock && catalog && snapshot) {
      return buildRuleCards(catalog.strategies, snapshot);
    }
    return snapshotCache.rules?.ruleCards ?? [];
  }, [useMock, catalog, snapshot, snapshotCache.rules]);

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
    if (!useMock && envelope) return envelope.summary.activeSignals;
    if (!snapshot) return 0;
    let count = 0;
    for (const ticker of snapshot.results) {
      for (const s of ticker.strategies) {
        if (s.qualityPct >= threshold) count += 1;
      }
    }
    return count;
  }, [useMock, envelope, snapshot, threshold]);

  const tickerCount = useMemo(() => {
    if (!useMock && envelope) return envelope.summary.tickerCount;
    return snapshot?.results.length ?? 0;
  }, [useMock, envelope, snapshot]);

  const strategyCount = useMemo(() => {
    if (!useMock && envelope) return envelope.summary.strategyCount;
    return catalog?.strategies.length ?? 0;
  }, [useMock, envelope, catalog]);

  const ruleCount = useMemo(() => {
    if (!useMock && envelope?.summary.ruleCount != null) return envelope.summary.ruleCount;
    if (!catalog) return undefined;
    return catalog.strategies.reduce((sum, s) => sum + s.rules.length, 0);
  }, [useMock, envelope, catalog]);

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

  const needsAssess = !useMock && !runId && !loading;

  return {
    loading: loading || snapshotLoading,
    error,
    catalog,
    snapshot,
    envelope,
    runId,
    useMock,
    needsAssess,
    search,
    setSearch,
    threshold,
    filteredStrategyCards,
    filteredTickerCards,
    filteredRuleCards,
    selectedStrategy,
    selectedTicker,
    selectedTickerResult,
    openStrategy,
    openTicker,
    closeDetail,
    activeSignalCount,
    strategyCount,
    tickerCount,
    ruleCount,
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
