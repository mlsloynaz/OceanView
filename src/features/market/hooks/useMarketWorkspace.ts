
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
  activeCatalogStrategies,
  countActiveRules,
  countActiveStrategies,
} from "../lib/catalog";
import {
  clampAssessmentTime,
  formatAssessmentDisplay,
  formatSimulationTimeEt,
  isAssessmentNow,
  parseEtDatetimeLocal,
  parseSimulationTimeEt,
  type AssessmentTimeMode,
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
  const [assessmentMode, setAssessmentModeState] = useState<AssessmentTimeMode>("now");
  const [lastAssessedAt, setLastAssessedAt] = useState<Date | null>(null);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [assessNotice, setAssessNotice] = useState<string | null>(null);
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

  const applyAssessmentValidation = useCallback(
    (date: Date, coverage: CandleCoverage) => {
      const validation = validateAssessmentTime(date, coverage);
      setAssessmentError(validation.error);
      setAssessNotice(validation.notice);
      return validation;
    },
    [],
  );

  useEffect(() => {
    if (!candleCoverage || coverageInitialized) return;
    if (lastAssessedAt && !isAssessmentNow(lastAssessedAt)) {
      const historical = clampAssessmentTime(lastAssessedAt, candleCoverage);
      setAssessmentModeState("et");
      setAssessmentAt(historical);
      applyAssessmentValidation(historical, candleCoverage);
    } else {
      const initial = new Date();
      setAssessmentAt(initial);
      applyAssessmentValidation(initial, candleCoverage);
      if (!lastAssessedAt) setLastAssessedAt(initial);
    }
    setCoverageInitialized(true);
  }, [applyAssessmentValidation, candleCoverage, coverageInitialized, lastAssessedAt]);

  useEffect(() => {
    if (!candleCoverage) return;
    const at = assessmentMode === "now" ? new Date() : assessmentAt;
    applyAssessmentValidation(at, candleCoverage);
  }, [applyAssessmentValidation, assessmentAt, assessmentMode, candleCoverage]);

  const setAssessmentMode = useCallback(
    (mode: AssessmentTimeMode) => {
      setAssessmentModeState(mode);
      if (!candleCoverage) return;
      if (mode === "now") {
        applyAssessmentValidation(new Date(), candleCoverage);
        return;
      }
      const historical =
        lastAssessedAt && !isAssessmentNow(lastAssessedAt) ? lastAssessedAt : null;
      const et = clampAssessmentTime(historical ?? new Date(), candleCoverage);
      setAssessmentAt(et);
      applyAssessmentValidation(et, candleCoverage);
    },
    [applyAssessmentValidation, candleCoverage, lastAssessedAt],
  );

  useEffect(() => {
    if (useMock) return;

    const refreshEnvelope = () => {
      if (document.visibilityState !== "visible") return;
      void fetchMarketEnvelope()
        .then((env) => setEnvelope(env))
        .catch(() => {
          /* ignore background refresh errors */
        });
    };

    document.addEventListener("visibilitychange", refreshEnvelope);
    window.addEventListener("focus", refreshEnvelope);
    return () => {
      document.removeEventListener("visibilitychange", refreshEnvelope);
      window.removeEventListener("focus", refreshEnvelope);
    };
  }, [useMock]);

  const fetchSnapshot = useCallback(
    async (mode: MarketViewMode, activeRunId: string | null, force = false) => {
      if (useMock) return;
      if (!force && snapshotCacheRef.current[mode]) return;

      const cat = catalogRef.current;
      if (!cat) return;

      setSnapshotLoading(true);
      try {
        const payload = await loadSnapshotForModeWithCatalog(mode, activeRunId, cat);
        if (activeRunId) {
          setRunId(payload.runId);
        }
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
    if (useMock || loading || !catalog) return;
    void fetchSnapshot(viewMode, runId);
  }, [useMock, runId, viewMode, loading, fetchSnapshot, catalog]);

  const setAssessmentFromLocal = useCallback(
    (localValue: string) => {
      if (!candleCoverage) return;
      const parsed = parseEtDatetimeLocal(localValue);
      if (!parsed) {
        setAssessmentError("Invalid date or time.");
        setAssessNotice(null);
        return;
      }
      setAssessmentModeState("et");
      setAssessmentAt(parsed);
      applyAssessmentValidation(parsed, candleCoverage);
    },
    [applyAssessmentValidation, candleCoverage],
  );

  const resolveAssessmentMoment = useCallback((): Date => {
    return assessmentMode === "now" ? new Date() : assessmentAt;
  }, [assessmentAt, assessmentMode]);

  const refreshAfterAssess = useCallback(
    async (newRunId: string, simulationTimeEt?: string | null) => {
      const env = await fetchMarketEnvelope();
      setEnvelope(env);
      setRunId(newRunId || env.runId);
      setSnapshotCache({});
      const sim = parseSimulationTimeEt(simulationTimeEt ?? env.simulationTimeEt);
      if (sim) {
        setLastAssessedAt(sim);
        if (!isAssessmentNow(sim)) {
          setAssessmentModeState("et");
          setAssessmentAt(sim);
        }
      } else {
        const at = resolveAssessmentMoment();
        setLastAssessedAt(at);
      }

      if (env.candleCoverage) {
        const at = sim ?? resolveAssessmentMoment();
        applyAssessmentValidation(at, env.candleCoverage);
      }

      const cat = catalogRef.current;
      const activeRunId = newRunId || env.runId;
      if (cat && activeRunId) {
        const payload = await loadSnapshotForModeWithCatalog(viewMode, activeRunId, cat);
        setSnapshotCache({
          [viewMode]: {
            strategyCards: payload.strategyCards,
            tickerCards: payload.tickerCards,
            ruleCards: payload.ruleCards,
          },
        });
      }
    },
    [applyAssessmentValidation, resolveAssessmentMoment, viewMode],
  );

  const runAssessment = useCallback(() => {
    if (!candleCoverage) return;
    const at = resolveAssessmentMoment();
    const validation = validateAssessmentTime(at, candleCoverage);
    if (validation.error) {
      setAssessmentError(validation.error);
      setAssessNotice(null);
      return;
    }

    if (useMock) {
      setAssessmentError(null);
      setAssessNotice(
        "Mock mode: assessment time updated only. Run npm run dev:local for live Assess against SAM.",
      );
      setAssessPending(true);
      window.setTimeout(() => {
        setLastAssessedAt(new Date(at.getTime()));
        setAssessPending(false);
      }, 400);
      return;
    }

    setAssessmentError(null);
    setAssessNotice(validation.notice);
    setAssessPending(true);
    void postMarketEvaluate({
      simulationTimeEt: formatSimulationTimeEt(at),
      options: { signalThresholdPct: envelope?.signalThresholdPct ?? 50 },
    })
      .then((result) => refreshAfterAssess(result.runId, formatSimulationTimeEt(at)))
      .catch((err) => {
        if (err instanceof MarketApiError) {
          const fallback = err.code ? MARKET_ERROR_MESSAGES[err.code] : undefined;
          const message = err.message || fallback || "Assessment failed.";
          if (err.code === "MARKET_EVAL_OUT_OF_COVERAGE" || err.code === "MARKET_NO_CANDLES") {
            setAssessmentError(null);
            setAssessNotice(message);
          } else {
            setAssessmentError(message);
            setAssessNotice(null);
          }
        } else {
          setAssessmentError(err instanceof Error ? err.message : "Assessment failed.");
          setAssessNotice(null);
        }
      })
      .finally(() => setAssessPending(false));
  }, [candleCoverage, envelope, refreshAfterAssess, resolveAssessmentMoment, useMock]);

  const strategies = useMemo(
    () => activeCatalogStrategies(catalog?.strategies),
    [catalog],
  );
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
    const activeIds = new Set(strategies.map((s) => s.id));
    let count = 0;
    for (const ticker of snapshot.results) {
      for (const s of ticker.strategies) {
        if (activeIds.has(s.strategyId) && s.qualityPct >= threshold) count += 1;
      }
    }
    return count;
  }, [useMock, envelope, snapshot, threshold, strategies]);

  const tickerCount = useMemo(() => {
    if (!useMock && envelope) return envelope.summary.tickerCount;
    return snapshot?.results.length ?? 0;
  }, [useMock, envelope, snapshot]);

  const strategyCount = useMemo(() => {
    if (!useMock && envelope) return envelope.summary.strategyCount;
    return countActiveStrategies(catalog);
  }, [useMock, envelope, catalog]);

  const ruleCount = useMemo(() => {
    if (!useMock && envelope?.summary.ruleCount != null) return envelope.summary.ruleCount;
    return countActiveRules(catalog);
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
    assessmentMode,
    assessmentAt,
    assessmentError,
    assessNotice,
    assessPending,
    setAssessmentMode,
    setAssessmentFromLocal,
    runAssessment,
    assessmentLabel,
  };
}