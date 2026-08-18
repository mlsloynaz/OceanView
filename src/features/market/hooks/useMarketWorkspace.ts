import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadMarketBootstrap,
  loadMarketWorkspaceDataMock,
  loadSnapshotForModeWithCatalog,
  marketDataUsesMock,
} from "../api/market-data";
import {
  clearMarketModeSnapshots,
  invalidateMarketSnapshotsCache,
  peekMarketWorkspaceCache,
  setMarketModeSnapshot,
} from "../api/market-workspace-cache";
import {
  MARKET_ERROR_MESSAGES,
  MarketApiError,
  fetchMarketEnvelope,
  isAssessUsable,
  isMarketAssessActive,
  postMarketEvaluate,
  postMarketEvaluateStop,
  pollMarketEvaluate,
  pollMarketEvaluateUntilSettled,
} from "../api/market-client";
import { buildRuleCards, buildStrategyCards, buildTickerCards } from "../display";
import {
  activeCatalogStrategies,
  countActiveRules,
  countActiveStrategies,
} from "../lib/catalog";
import {
  clampAssessmentTime,
  coverageBoundsForInput,
  formatAssessmentDisplay,
  formatSimulationTimeEt,
  isAssessmentNow,
  parseEtDatetimeLocal,
  parseSimulationTimeEt,
  type AssessmentTimeMode,
  blocksAssess,
  validateAssessmentTime,
  resolveMarketNowAssessmentMoment,
} from "../lib/assessment-time";
import { isStrategyInEntryWindow } from "../lib/entry-window";
import type { PollIntervalUnit } from "@/shared/components/PollControls";
import { useLiveMarketHours } from "@/shared/hooks/useLiveMarketHours";
import { defaultSimulationSessionDate } from "@/shared/lib/market-calendar";
import type {
  CandleCoverage,
  MarketEnvelope,
  MarketEvaluateStatusResponse,
  MarketSnapshotFile,
  MarketSnapshotMode,
  MarketViewMode,
  RuleCardModel,
  StrategiesCatalogFile,
  StrategyCatalogItem,
  StrategyCardModel,
  TickerCardModel,
  TickerEvalResult,
} from "../types";
import { isMarketSnapshotMode } from "../lib/market-routes";

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
    MarketSnapshotMode,
    {
      strategyCards?: StrategyCardModel[];
      tickerCards?: TickerCardModel[];
      ruleCards?: RuleCardModel[];
    }
  >
>;

const DEFAULT_INTERVAL_VALUE = 5;

function clampIntervalValue(value: number, unit: PollIntervalUnit): number {
  if (!Number.isFinite(value)) return DEFAULT_INTERVAL_VALUE;
  if (unit === "sec") {
    return Math.max(5, Math.min(3600, Math.round(value)));
  }
  return Math.max(1, Math.min(60, Math.round(value)));
}

function intervalToMs(value: number, unit: PollIntervalUnit): number {
  const clamped = clampIntervalValue(value, unit);
  return unit === "sec" ? clamped * 1000 : clamped * 60_000;
}

function continuousMonitorNotice(
  value: number,
  unit: PollIntervalUnit,
  mode: AssessmentTimeMode,
): string {
  const label = unit === "min" ? "min" : "sec";
  const base = `Monitoring — assessing every ${value} ${label} · Top Candidates update as tickers finish`;
  if (mode === "et") {
    return `${base}. Simulate mode reuses the same assessment time each tick.`;
  }
  return `${base}. Strategies outside their entry window are skipped.`;
}

function validationBlocks(
  at: Date,
  coverage: CandleCoverage,
  historicalOnly: boolean,
): boolean {
  const validation = validateAssessmentTime(at, coverage, { historicalOnly });
  if (validation.error) return true;
  if (historicalOnly && blocksAssess(at, coverage, { historicalOnly: true })) return true;
  return false;
}

function assessProgressNotice(
  progress: { completed?: number; total?: number } | null | undefined,
): string {
  const completed = Number(progress?.completed ?? 0);
  const total = Number(progress?.total ?? 0);
  if (total > 0) {
    return `Assessing… ${completed}/${total} tickers — Top Candidates update as each finishes.`;
  }
  if (completed > 0) {
    return `Assessing… ${completed} ticker(s) ready — Top Candidates updating.`;
  }
  return "Assessment running… Top Candidates will update as each ticker finishes.";
}

export function useMarketWorkspace(viewMode: MarketViewMode) {
  const useMock = marketDataUsesMock();
  const cached = peekMarketWorkspaceCache();

  const [catalog, setCatalog] = useState<StrategiesCatalogFile | null>(
    () => cached.catalog,
  );
  const [snapshot, setSnapshot] = useState<MarketSnapshotFile | null>(null);
  const [envelope, setEnvelope] = useState<MarketEnvelope | null>(() => cached.envelope);
  const [runId, setRunId] = useState<string | null>(() => cached.runId);
  const [snapshotCache, setSnapshotCache] = useState<SnapshotCache>(
    () => cached.snapshots,
  );
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const [loading, setLoading] = useState(() => !cached.catalog);
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
  const [refreshPending, setRefreshPending] = useState(false);
  const [stopPending, setStopPending] = useState(false);
  const [monitorActive, setMonitorActive] = useState(false);
  const [intervalValue, setIntervalValueState] = useState(DEFAULT_INTERVAL_VALUE);
  const [intervalUnit, setIntervalUnitState] = useState<PollIntervalUnit>("min");
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [jobActive, setJobActive] = useState(false);
  const [coverageInitialized, setCoverageInitialized] = useState(false);
  const { liveEnabled } = useLiveMarketHours();

  const catalogRef = useRef<StrategiesCatalogFile | null>(null);
  catalogRef.current = catalog;
  const snapshotCacheRef = useRef(snapshotCache);
  snapshotCacheRef.current = snapshotCache;
  const assessmentModeRef = useRef(assessmentMode);
  assessmentModeRef.current = assessmentMode;
  const assessInFlightRef = useRef(false);
  const monitorActiveRef = useRef(false);
  const intervalValueRef = useRef(DEFAULT_INTERVAL_VALUE);
  const intervalUnitRef = useRef<PollIntervalUnit>("min");
  const evaluateTimerRef = useRef<number | null>(null);
  const settleAbortRef = useRef(0);
  const jobActiveRef = useRef(false);

  monitorActiveRef.current = monitorActive;
  intervalValueRef.current = intervalValue;
  intervalUnitRef.current = intervalUnit;
  jobActiveRef.current = jobActive;

  const clearMonitorTimers = useCallback(() => {
    if (evaluateTimerRef.current != null) {
      window.clearInterval(evaluateTimerRef.current);
      evaluateTimerRef.current = null;
    }
    settleAbortRef.current += 1;
  }, []);

  useEffect(() => {
    return () => {
      clearMonitorTimers();
      monitorActiveRef.current = false;
    };
  }, [clearMonitorTimers]);

  useEffect(() => {
    let cancelled = false;
    const hadCatalog = Boolean(peekMarketWorkspaceCache().catalog);
    if (!hadCatalog) setLoading(true);
    setError(null);

    const load = useMock
      ? loadMarketWorkspaceDataMock().then((data) => {
          if (cancelled) return;
          setCatalog(data.catalog);
          setSnapshot(data.snapshot);
          setEnvelope(null);
          setRunId(null);
          setSnapshotCache({});
          clearMarketModeSnapshots();
        })
      : (() => {
          const prev = peekMarketWorkspaceCache();
          const prevRun = prev.runId;
          const prevSnapshots = prev.snapshots;
          return loadMarketBootstrap({ force: true }).then((data) => {
            if (cancelled) return;
            setCatalog(data.catalog);
            setEnvelope(data.envelope);
            setRunId(data.envelope.runId);
            setSnapshot(null);
            if (prevRun && prevRun !== data.envelope.runId) {
              setSnapshotCache({});
              invalidateMarketSnapshotsCache();
            } else {
              setSnapshotCache(prevSnapshots);
            }
            const sim = parseSimulationTimeEt(data.envelope.simulationTimeEt);
            if (sim) setLastAssessedAt(sim);
            else if (data.envelope.evaluatedAt) {
              const evaluated = new Date(data.envelope.evaluatedAt);
              if (!Number.isNaN(evaluated.getTime())) setLastAssessedAt(evaluated);
            }
          });
        })();

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

  const coverageBounds = useMemo(
    () => (candleCoverage ? coverageBoundsForInput(candleCoverage) : null),
    [candleCoverage],
  );

  const applyAssessmentValidation = useCallback(
    (date: Date, coverage: CandleCoverage, historicalOnly = false) => {
      const validation = validateAssessmentTime(date, coverage, { historicalOnly });
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
      applyAssessmentValidation(historical, candleCoverage, true);
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
    applyAssessmentValidation(at, candleCoverage, assessmentMode === "et");
  }, [applyAssessmentValidation, assessmentAt, assessmentMode, candleCoverage]);

  const setAssessmentMode = useCallback(
    (mode: AssessmentTimeMode) => {
      if (mode === "now" && !liveEnabled) return;
      setAssessmentModeState(mode);
      if (!candleCoverage) return;
      if (mode === "now") {
        applyAssessmentValidation(new Date(), candleCoverage);
        return;
      }
      const historical =
        lastAssessedAt && !isAssessmentNow(lastAssessedAt) ? lastAssessedAt : null;
      const closeSeed = resolveMarketNowAssessmentMoment();
      const fallbackSession = parseEtDatetimeLocal(`${defaultSimulationSessionDate()}T16:00`);
      const et = clampAssessmentTime(
        historical ?? closeSeed ?? fallbackSession ?? new Date(),
        candleCoverage,
      );
      setAssessmentAt(et);
      applyAssessmentValidation(et, candleCoverage, true);
    },
    [applyAssessmentValidation, candleCoverage, lastAssessedAt, liveEnabled],
  );

  // Outside RTH: Live assess is blocked — force Simulate at last session close.
  useEffect(() => {
    if (liveEnabled || assessmentMode !== "now") return;
    const closeSeed = resolveMarketNowAssessmentMoment();
    setAssessmentModeState("et");
    if (candleCoverage) {
      const et = clampAssessmentTime(closeSeed, candleCoverage);
      setAssessmentAt(et);
      applyAssessmentValidation(et, candleCoverage, true);
    } else {
      setAssessmentAt(closeSeed);
    }
  }, [applyAssessmentValidation, assessmentMode, candleCoverage, liveEnabled]);

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
      if (useMock || !isMarketSnapshotMode(mode)) return;
      if (!force && snapshotCacheRef.current[mode]) return;

      const cat = catalogRef.current;
      if (!cat) return;

      const hadCards = Boolean(snapshotCacheRef.current[mode]);
      if (!hadCards) setSnapshotLoading(true);
      try {
        const payload = await loadSnapshotForModeWithCatalog(mode, activeRunId, cat);
        if (activeRunId) {
          setRunId(payload.runId);
        }
        const next = {
          strategyCards: payload.strategyCards,
          tickerCards: payload.tickerCards,
          ruleCards: payload.ruleCards,
        };
        setSnapshotCache((prev) => ({
          ...prev,
          [mode]: next,
        }));
        setMarketModeSnapshot(mode, next, payload.runId);
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
      if (!localValue.trim()) {
        setAssessmentError(null);
        setAssessNotice(null);
        return;
      }
      if (!candleCoverage) return;
      const parsed = parseEtDatetimeLocal(localValue);
      if (!parsed) {
        setAssessmentError("Invalid date or time.");
        setAssessNotice(null);
        return;
      }
      setAssessmentModeState("et");
      setAssessmentAt(parsed);
      applyAssessmentValidation(parsed, candleCoverage, true);
    },
    [applyAssessmentValidation, candleCoverage],
  );

  const resolveAssessmentMoment = useCallback((): Date => {
    return assessmentMode === "now" ? resolveMarketNowAssessmentMoment() : assessmentAt;
  }, [assessmentAt, assessmentMode]);

  const setIntervalValue = useCallback((value: number) => {
    setIntervalValueState(clampIntervalValue(value, intervalUnitRef.current));
  }, []);

  const setIntervalUnit = useCallback((unit: PollIntervalUnit) => {
    setIntervalUnitState(unit);
    setIntervalValueState((prev) => clampIntervalValue(prev, unit));
  }, []);

  const eligibleStrategyIds = useCallback((at: Date): string[] => {
    const cat = catalogRef.current;
    if (!cat) return [];
    return activeCatalogStrategies(cat.strategies)
      .filter((s) => isStrategyInEntryWindow(s.entryWindow, at))
      .map((s) => s.id);
  }, []);

  const refreshAfterAssess = useCallback(
    async (newRunId: string, simulationTimeEt?: string | null) => {
      const env = await fetchMarketEnvelope();
      setEnvelope(env);
      setRunId(newRunId || env.runId);
      setSnapshotCache({});
      invalidateMarketSnapshotsCache();
      const mode = assessmentModeRef.current;
      const sim = parseSimulationTimeEt(simulationTimeEt ?? env.simulationTimeEt);
      if (sim) {
        setLastAssessedAt(sim);
        // Stay in Live after a now-mode run; only mirror Simulate when the user was in ET mode.
        if (mode === "et") {
          setAssessmentAt(sim);
        }
      } else if (env.evaluatedAt) {
        const evaluated = new Date(env.evaluatedAt);
        if (!Number.isNaN(evaluated.getTime())) setLastAssessedAt(evaluated);
      } else {
        const at = resolveAssessmentMoment();
        setLastAssessedAt(at);
      }

      if (env.candleCoverage) {
        const at = mode === "now" ? new Date() : (sim ?? resolveAssessmentMoment());
        applyAssessmentValidation(at, env.candleCoverage, mode === "et");
      }

      const cat = catalogRef.current;
      const activeRunId = newRunId || env.runId;
      if (cat && activeRunId && isMarketSnapshotMode(viewMode)) {
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

  const followAfterPostAssessDelay = useCallback(
    async (activeRunId: string) => {
      const settleToken = ++settleAbortRef.current;
      let lastLoadedCompleted = -1;
      let refreshChain: Promise<void> = Promise.resolve();

      const loadPartialIfNew = (status: MarketEvaluateStatusResponse | null | undefined) => {
        if (!status || settleToken !== settleAbortRef.current) return;
        const completed = Number(status.progress?.completed ?? 0);
        if (isMarketAssessActive(status.status) || isAssessUsable(status.status)) {
          setAssessNotice(assessProgressNotice(status.progress));
        }
        // Wait until at least one ticker is persisted — otherwise we would reload the prior run.
        if (!isAssessUsable(status.status) || completed <= 0 || completed <= lastLoadedCompleted) {
          return;
        }
        lastLoadedCompleted = completed;
        const historicalOnly = assessmentMode === "et";
        const at = resolveAssessmentMoment();
        refreshChain = refreshChain
          .catch(() => undefined)
          .then(async () => {
            if (settleToken !== settleAbortRef.current) return;
            await refreshAfterAssess(
              activeRunId,
              historicalOnly ? formatSimulationTimeEt(at) : null,
            );
          });
      };

      try {
        setAssessNotice(assessProgressNotice(null));
        const settled = await pollMarketEvaluateUntilSettled(activeRunId, (progress) => {
          loadPartialIfNew(progress);
        });
        if (settleToken !== settleAbortRef.current) return;

        await refreshChain.catch(() => undefined);
        if (settleToken !== settleAbortRef.current) return;

        loadPartialIfNew(settled);
        await refreshChain.catch(() => undefined);
        if (settleToken !== settleAbortRef.current) return;

        // Final load — covers terminal statuses and any missed progress tick.
        const historicalOnly = assessmentMode === "et";
        const at = resolveAssessmentMoment();
        await refreshAfterAssess(
          activeRunId,
          historicalOnly ? formatSimulationTimeEt(at) : null,
        );
        if (settleToken !== settleAbortRef.current) return;

        setPendingRunId(null);
        if (monitorActiveRef.current) {
          setAssessNotice(
            continuousMonitorNotice(
              intervalValueRef.current,
              intervalUnitRef.current,
              assessmentMode,
            ),
          );
        } else {
          setAssessNotice(null);
        }
        setJobActive(false);
      } catch {
        /* keep partial UI; next cycle or Refresh can recover */
        if (settleToken === settleAbortRef.current) {
          setJobActive(false);
          setAssessNotice("Assessment finished, but loading results failed — try Refresh result.");
        }
      }
    },
    [assessmentMode, refreshAfterAssess, resolveAssessmentMoment],
  );

  const runAssessCycle = useCallback(
    async (opts?: { continuous?: boolean }) => {
      const continuous = Boolean(opts?.continuous);
      if (!candleCoverage) return;
      if (assessInFlightRef.current) return;
      const at = resolveAssessmentMoment();
      const historicalOnly = assessmentMode === "et";
      const validation = validateAssessmentTime(at, candleCoverage, { historicalOnly });
      if (
        validation.error ||
        (historicalOnly && blocksAssess(at, candleCoverage, { historicalOnly: true }))
      ) {
        setAssessmentError(validation.error);
        setAssessNotice(null);
        return;
      }

      const strategyIds = eligibleStrategyIds(at);
      if (strategyIds.length === 0) {
        setAssessmentError(null);
        setAssessNotice(
          continuous
            ? "No standard strategies in entry window — skipping this tick."
            : "No standard strategies are inside their entry window right now.",
        );
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

      assessInFlightRef.current = true;
      setAssessPending(true);
      setJobActive(true);
      setAssessmentError(null);
      setAssessNotice(
        continuous
          ? continuousMonitorNotice(
              intervalValueRef.current,
              intervalUnitRef.current,
              assessmentMode,
            )
          : historicalOnly
            ? null
            : validation.notice,
      );

      try {
        const start = await postMarketEvaluate({
          assessmentTimeMode: assessmentMode,
          strategyIds,
          ...(historicalOnly ? { simulationTimeEt: formatSimulationTimeEt(at) } : {}),
          options: { signalThresholdPct: envelope?.signalThresholdPct ?? 50 },
        });
        setPendingRunId(start.runId);
        setRunId(start.runId);
        await pollMarketEvaluate(start.runId);
        void followAfterPostAssessDelay(start.runId);
        if (!continuous) {
          setAssessNotice(
            start.message ??
              "Assessment running… Top Candidates will update as each ticker finishes.",
          );
        }
      } catch (err) {
        setJobActive(false);
        if (err instanceof MarketApiError) {
          const fallback = err.code ? MARKET_ERROR_MESSAGES[err.code] : undefined;
          const message = err.message || fallback || "Assessment failed.";
          if (
            err.code === "MARKET_EVAL_OUT_OF_COVERAGE" ||
            err.code === "MARKET_NO_CANDLES" ||
            err.code === "MARKET_HOURS_CLOSED"
          ) {
            setAssessmentError(null);
            setAssessNotice(message);
          } else if (err.code === "MARKET_EVAL_CONFLICT") {
            setAssessmentError(null);
            setAssessNotice(message);
            setJobActive(true);
          } else {
            setAssessmentError(message);
            setAssessNotice(null);
          }
        } else {
          setAssessmentError(err instanceof Error ? err.message : "Assessment failed.");
          setAssessNotice(null);
        }
      } finally {
        assessInFlightRef.current = false;
        setAssessPending(false);
      }
    },
    [
      assessmentMode,
      candleCoverage,
      eligibleStrategyIds,
      envelope,
      followAfterPostAssessDelay,
      resolveAssessmentMoment,
      useMock,
    ],
  );

  const runAssessment = useCallback(() => {
    if (monitorActiveRef.current || assessInFlightRef.current) return;
    void runAssessCycle({ continuous: false });
  }, [runAssessCycle]);

  const startPolling = useCallback(() => {
    if (monitorActiveRef.current) return;
    if (!candleCoverage) return;
    const at = resolveAssessmentMoment();
    const historicalOnly = assessmentMode === "et";
    if (
      validationBlocks(at, candleCoverage, historicalOnly) ||
      (historicalOnly && assessmentError)
    ) {
      return;
    }

    const value = clampIntervalValue(intervalValueRef.current, intervalUnitRef.current);
    const unit = intervalUnitRef.current;
    setIntervalValueState(value);
    intervalValueRef.current = value;

    monitorActiveRef.current = true;
    setMonitorActive(true);
    setAssessmentError(null);
    setAssessNotice(continuousMonitorNotice(value, unit, assessmentMode));
    clearMonitorTimers();

    evaluateTimerRef.current = window.setInterval(() => {
      if (!monitorActiveRef.current) return;
      if (assessInFlightRef.current || jobActiveRef.current) return;
      void runAssessCycle({ continuous: true });
    }, intervalToMs(value, unit));

    void runAssessCycle({ continuous: true });
  }, [
    assessmentError,
    assessmentMode,
    candleCoverage,
    clearMonitorTimers,
    resolveAssessmentMoment,
    runAssessCycle,
  ]);

  const stopAssessment = useCallback(async () => {
    const wasMonitoring = monitorActiveRef.current;
    monitorActiveRef.current = false;
    setMonitorActive(false);
    clearMonitorTimers();

    setStopPending(true);
    setError(null);
    try {
      if (jobActiveRef.current || assessInFlightRef.current || wasMonitoring) {
        const payload = await postMarketEvaluateStop();
        setJobActive(isMarketAssessActive(payload.status));
        setAssessNotice(
          wasMonitoring
            ? "Continuous assess stopped."
            : (payload.message ?? "Stop requested."),
        );
      } else {
        setAssessNotice(wasMonitoring ? "Continuous assess stopped." : null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop assessment.");
      if (wasMonitoring) setAssessNotice("Continuous assess stopped.");
    } finally {
      setStopPending(false);
      setJobActive(false);
      assessInFlightRef.current = false;
      setAssessPending(false);
    }
  }, [clearMonitorTimers]);

  const refreshResult = useCallback(async () => {
    if (useMock) return;
    const activeRunId = pendingRunId ?? runId;
    if (!activeRunId) {
      setAssessNotice("No assessment run yet — click Assess first.");
      return;
    }
    setRefreshPending(true);
    setError(null);
    try {
      const historicalOnly = assessmentMode === "et";
      const at = resolveAssessmentMoment();
      await refreshAfterAssess(
        activeRunId,
        historicalOnly ? formatSimulationTimeEt(at) : null,
      );
      setPendingRunId(null);
      if (monitorActiveRef.current) {
        setAssessNotice(
          continuousMonitorNotice(
            intervalValueRef.current,
            intervalUnitRef.current,
            assessmentMode,
          ),
        );
      } else {
        setAssessNotice(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh assessment results.");
    } finally {
      setRefreshPending(false);
    }
  }, [
    assessmentMode,
    pendingRunId,
    refreshAfterAssess,
    resolveAssessmentMoment,
    runId,
    useMock,
  ]);

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
    const fromEnvelope = parseSimulationTimeEt(envelope?.simulationTimeEt ?? null);
    const at = fromEnvelope ?? lastAssessedAt ?? assessmentAt;
    const prefix = isAssessmentNow(at) ? "Live" : "Assessed";
    return `${prefix} ${formatAssessmentDisplay(at)}`;
  }, [assessmentAt, envelope?.simulationTimeEt, lastAssessedAt]);

  const lastAssessmentLabel = useMemo(() => {
    if (!lastAssessedAt && !envelope?.evaluatedAt) return null;
    const at =
      lastAssessedAt ?? (envelope?.evaluatedAt ? new Date(envelope.evaluatedAt) : null);
    if (!at || Number.isNaN(at.getTime())) return null;
    return formatAssessmentDisplay(at);
  }, [envelope?.evaluatedAt, lastAssessedAt]);

  const needsAssess = !useMock && !runId && !loading;
  const canStop = monitorActive || jobActive || assessPending;

  const hasModeCards =
    viewMode === "strategies"
      ? Boolean(snapshotCache.strategies?.strategyCards?.length)
      : viewMode === "tickers"
        ? Boolean(snapshotCache.tickers?.tickerCards?.length)
        : Boolean(snapshotCache.rules?.ruleCards?.length);

  return {
    loading: loading || (snapshotLoading && !hasModeCards),
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
    coverageBounds,
    assessmentMode,
    assessmentAt,
    assessmentError,
    assessNotice,
    assessPending,
    refreshPending,
    monitorActive,
    stopPending,
    canStop,
    liveEnabled,
    intervalValue,
    intervalUnit,
    setIntervalValue,
    setIntervalUnit,
    setAssessmentMode,
    setAssessmentFromLocal,
    runAssessment,
    startPolling,
    stopAssessment,
    refreshResult,
    assessmentLabel,
    lastAssessmentLabel,
  };
}
