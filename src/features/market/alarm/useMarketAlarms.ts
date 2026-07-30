import { useCallback, useEffect, useRef, useState } from "react";
import { getActiveTickersForAdmin } from "@/features/admin/tickers/api/tickers-client";
import type { CatalogTicker } from "@/features/admin/tickers/types";
import {
  formatEtDatetimeLocal,
  formatSimulationTimeEt,
  parseEtDatetimeLocal,
} from "@/features/market/lib/assessment-time";
import {
  clampPollInterval,
  pollIntervalToMs,
  type PollIntervalUnit,
} from "@/shared/components/PollControls";
import type { LiveSimulateMode } from "@/shared/components/LiveSimulateControl";
import { MarketAlarmApiError, postMarketAlarmCheck } from "./alarm-client";
import {
  ALARM_ELIGIBLE_RULES,
  alarmRulesLabel,
  type AlarmEligibleRuleKey,
  type AlarmPopupKind,
  type AlarmTrend,
  type MarketAlarmWatch,
} from "./alarm-types";
import { playAlarmBell } from "./play-alarm-bell";

const STORAGE_KEY = "oceanview.market.alarms";
const SIM_STORAGE_KEY = "oceanview.market.alarms.simulate";

/** Migrate watches saved before confirmation_change_trend replaced candle_confirm. */
const LEGACY_ALARM_RULE_KEYS: Record<string, AlarmEligibleRuleKey> = {
  candle_confirm_1h: "confirmation_change_trend_1h",
  candle_confirm_15m: "confirmation_change_trend_15m",
};

function mapRuleKey(key: string): AlarmEligibleRuleKey {
  const mapped = LEGACY_ALARM_RULE_KEYS[key] ?? key;
  return mapped as AlarmEligibleRuleKey;
}

function normalizeRuleKeys(keys: string[]): AlarmEligibleRuleKey[] {
  const out: AlarmEligibleRuleKey[] = [];
  for (const raw of keys) {
    const key = mapRuleKey(String(raw || "").trim());
    if (!key) continue;
    if (!ALARM_ELIGIBLE_RULES.some((r) => r.ruleKey === key)) continue;
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

function ruleKeysSignature(keys: AlarmEligibleRuleKey[]): string {
  return [...keys].sort().join("+");
}

function migrateWatch(row: MarketAlarmWatch): MarketAlarmWatch {
  const fromList =
    Array.isArray(row.ruleKeys) && row.ruleKeys.length > 0
      ? row.ruleKeys
      : row.ruleKey
        ? [row.ruleKey]
        : [];
  const ruleKeys = normalizeRuleKeys(fromList);
  const ruleKey = ruleKeys[0] ?? mapRuleKey(row.ruleKey);
  const status: MarketAlarmWatch["status"] =
    row.status === "running" || row.status === "checking" || row.status === "in_trade"
      ? "stopped"
      : row.status;
  return {
    ...row,
    ruleKey,
    ruleKeys: ruleKeys.length > 0 ? ruleKeys : [ruleKey],
    ruleLabel: alarmRulesLabel(ruleKeys.length > 0 ? ruleKeys : [ruleKey]),
    status,
  };
}

function loadStored(): MarketAlarmWatch[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MarketAlarmWatch[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row) => migrateWatch(row));
  } catch {
    return [];
  }
}

function persist(watches: MarketAlarmWatch[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(watches));
  } catch {
    /* ignore quota */
  }
}

export function useMarketAlarms() {
  const [watches, setWatches] = useState<MarketAlarmWatch[]>(() => loadStored());
  const [tickers, setTickers] = useState<CatalogTicker[]>([]);
  const [tickersLoading, setTickersLoading] = useState(true);
  const [tickersError, setTickersError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [alarmPopup, setAlarmPopup] = useState<{
    kind: AlarmPopupKind;
    watch: MarketAlarmWatch;
  } | null>(null);
  const [timeMode, setTimeMode] = useState<LiveSimulateMode>(() => {
    try {
      return sessionStorage.getItem(SIM_STORAGE_KEY) === "simulate" ? "simulate" : "live";
    } catch {
      return "live";
    }
  });
  const [simulateLocal, setSimulateLocal] = useState(() => formatEtDatetimeLocal(new Date()));

  const timersRef = useRef<Map<string, number>>(new Map());
  /** Watch ids currently executing a check (HTTP in flight). */
  const inFlightRef = useRef<Set<string>>(new Set());
  /** FIFO of watch ids waiting for a free check slot. */
  const checkQueueRef = useRef<string[]>([]);
  const queuedIdsRef = useRef<Set<string>>(new Set());
  const activeChecksRef = useRef(0);
  /** Cap parallel /market/alarm/check calls — avoids API Gateway throttle + ~29s timeouts. */
  const MAX_PARALLEL_CHECKS = 3;
  /** Per-symbol candle refresh timestamps — avoid duplicate Schwab pulls. */
  const lastCandleRefreshRef = useRef<Map<string, number>>(new Map());
  const watchesRef = useRef(watches);
  watchesRef.current = watches;
  const timeModeRef = useRef(timeMode);
  timeModeRef.current = timeMode;
  const simulateLocalRef = useRef(simulateLocal);
  simulateLocalRef.current = simulateLocal;

  useEffect(() => {
    persist(watches);
  }, [watches]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SIM_STORAGE_KEY, timeMode);
    } catch {
      /* ignore */
    }
  }, [timeMode]);

  useEffect(() => {
    let cancelled = false;
    setTickersLoading(true);
    void getActiveTickersForAdmin()
      .then((res) => {
        if (cancelled) return;
        setTickers(res.tickers ?? []);
        setTickersError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setTickersError(err instanceof Error ? err.message : "Failed to load tickers.");
      })
      .finally(() => {
        if (!cancelled) setTickersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clearTimer = useCallback((id: string) => {
    const existing = timersRef.current.get(id);
    if (existing != null) {
      window.clearInterval(existing);
      timersRef.current.delete(id);
    }
  }, []);

  const stopAllTimers = useCallback(() => {
    for (const id of [...timersRef.current.keys()]) {
      clearTimer(id);
    }
  }, [clearTimer]);

  useEffect(() => {
    return () => stopAllTimers();
  }, [stopAllTimers]);

  /**
   * Skip candle refresh if same symbol was refreshed recently (shared across watches).
   * Cooldown follows the *longest* poll interval among active watches on that symbol
   * so multi-criteria / multi-watch setups pull Schwab candles once per big cadence.
   */
  const shouldRefreshCandles = useCallback((symbol: string) => {
    const upper = symbol.toUpperCase();
    const last = lastCandleRefreshRef.current.get(upper) ?? 0;
    const sameSymbolWatches = watchesRef.current.filter(
      (w) =>
        w.symbol === upper &&
        (w.status === "running" ||
          w.status === "checking" ||
          w.status === "in_trade" ||
          timersRef.current.has(w.id)),
    );
    let maxMs = 0;
    for (const w of sameSymbolWatches) {
      const ms = pollIntervalToMs(w.frequencyValue, w.frequencyUnit);
      if (ms > maxMs) maxMs = ms;
    }
    const cooldown = Math.max(15_000, maxMs || 60_000);
    return Date.now() - last >= cooldown;
  }, []);

  const markCandleRefreshed = useCallback((symbol: string) => {
    lastCandleRefreshRef.current.set(symbol.toUpperCase(), Date.now());
  }, []);

  const executeCheck = useCallback(
    async (id: string) => {
      const watch = watchesRef.current.find((w) => w.id === id);
      // Waiting for user on enter/exit popup — do not poll.
      if (!watch || watch.status === "met" || watch.status === "exit") return;

      inFlightRef.current.add(id);
      const priorStatus = watch.status;
      setWatches((prev) =>
        prev.map((w) =>
          w.id === id
            ? {
                ...w,
                status: priorStatus === "in_trade" ? "in_trade" : "checking",
                lastError: null,
              }
            : w,
        ),
      );

      const simulating = timeModeRef.current === "simulate";
      let simulationTimeEt: string | undefined;
      if (simulating) {
        const parsed = parseEtDatetimeLocal(simulateLocalRef.current);
        if (!parsed) {
          setWatches((prev) =>
            prev.map((w) =>
              w.id === id
                ? {
                    ...w,
                    status:
                      priorStatus === "in_trade"
                        ? "in_trade"
                        : timersRef.current.has(id)
                          ? "running"
                          : "error",
                    lastError: "Invalid simulate date/time (ET).",
                  }
                : w,
            ),
          );
          return;
        }
        simulationTimeEt = formatSimulationTimeEt(parsed);
      }

      const refreshCandles = simulating ? false : shouldRefreshCandles(watch.symbol);

      try {
        const ruleKeys =
          watch.ruleKeys?.length > 0 ? watch.ruleKeys : [watch.ruleKey];
        const result = await postMarketAlarmCheck({
          symbol: watch.symbol,
          ruleKeys,
          ruleKey: ruleKeys[0],
          trend: watch.trend,
          refreshCandles,
          ...(watch.bandTimeframe ? { bandTimeframe: watch.bandTimeframe } : {}),
          ...(simulationTimeEt ? { simulationTimeEt } : {}),
        });

        const candleFailed =
          result.candle?.status === "failed" ||
          (result.candle as { outcome?: string } | null | undefined)?.outcome === "failed";
        if (!simulating && refreshCandles && !candleFailed) {
          markCandleRefreshed(watch.symbol);
        }

        const detectedRaw = result.detectedTrend || result.suggestedTrend || null;
        const detectedTrend =
          detectedRaw === "alcista" || detectedRaw === "bajista" || detectedRaw === "auto"
            ? detectedRaw
            : null;
        const sideLabel =
          detectedTrend === "alcista" || detectedTrend === "bajista"
            ? detectedTrend
            : watch.trend === "auto"
              ? "auto"
              : watch.trend;
        const simSuffix =
          simulating && result.simulationTimeEt
            ? ` · sim ${new Date(result.simulationTimeEt).toLocaleString()}`
            : "";

        const patchBase = {
          lastRuleStatus: result.ruleStatus,
          lastEvidence: result.evidence ?? null,
          lastCheckedAt: result.checkedAt,
          lastError: result.error ?? null,
          lastRuleResults: result.ruleResults ?? null,
          lastBreakoutScore:
            typeof result.breakoutScore === "number"
              ? result.breakoutScore
              : (watch.lastBreakoutScore ?? null),
          lastDetectedTrend: detectedTrend ?? watch.lastDetectedTrend ?? null,
        };

        // In trade: rule dropped → EXIT signal
        if (priorStatus === "in_trade" && !result.met) {
          clearTimer(id);
          const exitWatch: MarketAlarmWatch = {
            ...watch,
            ...patchBase,
            status: "exit",
            exitedAt: result.checkedAt,
            exitEvidence: result.evidence ?? "Setup no longer met — consider exit.",
          };
          setWatches((prev) => prev.map((w) => (w.id === id ? exitWatch : w)));
          setBanner(
            `${result.symbol} · ${watch.ruleLabel} (${sideLabel}) EXIT — setup gone.${simSuffix}`,
          );
          setAlarmPopup({ kind: "exit", watch: exitWatch });
          playAlarmBell();
          try {
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification(`Exit: ${watch.symbol}`, {
                body: `${watch.ruleLabel} · ${sideLabel} — exit now`,
                tag: `ov-market-alarm-exit-${watch.id}`,
              });
            }
          } catch {
            /* ignore */
          }
          return;
        }

        // In trade and still met — keep monitoring
        if (priorStatus === "in_trade" && result.met) {
          setWatches((prev) =>
            prev.map((w) =>
              w.id === id
                ? {
                    ...w,
                    ...patchBase,
                    status: "in_trade",
                  }
                : w,
            ),
          );
          return;
        }

        // Fresh enter signal
        if (result.met) {
          clearTimer(id);
          const metWatch: MarketAlarmWatch = {
            ...watch,
            ...patchBase,
            status: "met",
            metAt: result.checkedAt,
            enteredAt: null,
            exitedAt: null,
            exitEvidence: null,
            lastError: null,
            lastDetectedTrend: detectedTrend ?? watch.trend,
          };
          setWatches((prev) => prev.map((w) => (w.id === id ? metWatch : w)));
          setBanner(
            `${result.symbol} · ${watch.ruleLabel} (${sideLabel}) ENTER — rule met.${simSuffix}`,
          );
          setAlarmPopup({ kind: "enter", watch: metWatch });
          playAlarmBell();
          try {
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification(`Enter: ${watch.symbol}`, {
                body: `${watch.ruleLabel} · ${sideLabel} — enter now`,
                tag: `ov-market-alarm-enter-${watch.id}`,
              });
            }
          } catch {
            /* ignore */
          }
          return;
        }

        setWatches((prev) =>
          prev.map((w) =>
            w.id === id
              ? {
                  ...w,
                  ...patchBase,
                  status: "running",
                }
              : w,
          ),
        );
      } catch (err) {
        const message =
          err instanceof MarketAlarmApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Alarm check failed.";
        setWatches((prev) =>
          prev.map((w) =>
            w.id === id
              ? {
                  ...w,
                  status:
                    priorStatus === "in_trade"
                      ? "in_trade"
                      : timersRef.current.has(id)
                        ? "running"
                        : "error",
                  lastError: message,
                }
              : w,
          ),
        );
      } finally {
        inFlightRef.current.delete(id);
      }
    },
    [clearTimer, markCandleRefreshed, shouldRefreshCandles],
  );

  const pumpCheckQueue = useCallback(() => {
    while (
      activeChecksRef.current < MAX_PARALLEL_CHECKS &&
      checkQueueRef.current.length > 0
    ) {
      const id = checkQueueRef.current.shift()!;
      queuedIdsRef.current.delete(id);
      const watch = watchesRef.current.find((w) => w.id === id);
      if (
        !watch ||
        watch.status === "met" ||
        watch.status === "exit" ||
        inFlightRef.current.has(id)
      ) {
        continue;
      }
      activeChecksRef.current += 1;
      void executeCheck(id).finally(() => {
        activeChecksRef.current = Math.max(0, activeChecksRef.current - 1);
        pumpCheckQueue();
      });
    }
  }, [executeCheck]);

  /** Enqueue a check; at most MAX_PARALLEL_CHECKS run at once across all watches. */
  const runCheck = useCallback(
    (id: string) => {
      const watch = watchesRef.current.find((w) => w.id === id);
      if (!watch || watch.status === "met" || watch.status === "exit") return;
      if (inFlightRef.current.has(id) || queuedIdsRef.current.has(id)) return;
      queuedIdsRef.current.add(id);
      checkQueueRef.current.push(id);
      pumpCheckQueue();
    },
    [pumpCheckQueue],
  );

  const startWatch = useCallback(
    (id: string, opts?: { mode?: "hunt" | "in_trade" }) => {
      const watch = watchesRef.current.find((w) => w.id === id);
      if (!watch) return;
      // Enter confirm may still see status "met" until state flushes.
      if (watch.status === "met" && opts?.mode !== "in_trade") return;
      if (watch.status === "exit" && opts?.mode !== "hunt") return;

      const mode =
        opts?.mode ?? (watch.status === "in_trade" ? "in_trade" : "hunt");

      clearTimer(id);
      setFormError(null);
      setWatches((prev) =>
        prev.map((w) =>
          w.id === id
            ? {
                ...w,
                status: mode === "in_trade" ? "in_trade" : "running",
                lastError: null,
                ...(mode === "hunt"
                  ? {
                      metAt: null,
                      enteredAt: null,
                      exitedAt: null,
                      exitEvidence: null,
                    }
                  : {}),
              }
            : w,
        ),
      );

      const unit =
        watch.frequencyUnit === "hour" || watch.frequencyUnit === "sec"
          ? watch.frequencyUnit
          : "min";
      const ms = pollIntervalToMs(clampPollInterval(watch.frequencyValue, unit), unit);
      window.setTimeout(() => {
        void runCheck(id);
        if (!timersRef.current.has(id)) {
          const timer = window.setInterval(() => void runCheck(id), ms);
          timersRef.current.set(id, timer);
        }
      }, 0);
    },
    [clearTimer, runCheck],
  );

  const stopWatch = useCallback(
    (id: string) => {
      clearTimer(id);
      setWatches((prev) =>
        prev.map((w) =>
          w.id === id && w.status !== "met" && w.status !== "exit"
            ? { ...w, status: w.status === "in_trade" ? "stopped" : "stopped" }
            : w,
        ),
      );
    },
    [clearTimer],
  );

  const updateWatchInterval = useCallback(
    (id: string, value: number, unit: PollIntervalUnit) => {
      const nextUnit = unit === "hour" || unit === "sec" ? unit : "min";
      const nextValue = clampPollInterval(value, nextUnit);
      setWatches((prev) =>
        prev.map((w) =>
          w.id === id
            ? { ...w, frequencyValue: nextValue, frequencyUnit: nextUnit }
            : w,
        ),
      );
      const watch = watchesRef.current.find((w) => w.id === id);
      if (watch && (watch.status === "running" || watch.status === "checking" || watch.status === "in_trade")) {
        clearTimer(id);
        const ms = pollIntervalToMs(nextValue, nextUnit);
        const timer = window.setInterval(() => void runCheck(id), ms);
        timersRef.current.set(id, timer);
      }
    },
    [clearTimer, runCheck],
  );

  const removeWatch = useCallback(
    (id: string) => {
      clearTimer(id);
      setWatches((prev) => prev.filter((w) => w.id !== id));
    },
    [clearTimer],
  );

  const clearMetBanner = useCallback(() => setBanner(null), []);
  const clearAlarmPopup = useCallback(() => setAlarmPopup(null), []);

  /** User confirmed enter — keep polling until setup drops (exit). */
  const confirmEnter = useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      setAlarmPopup(null);
      setBanner(null);
      setWatches((prev) =>
        prev.map((w) =>
          w.id === id
            ? {
                ...w,
                status: "in_trade",
                enteredAt: now,
                exitedAt: null,
                exitEvidence: null,
                lastError: null,
              }
            : w,
        ),
      );
      window.setTimeout(() => startWatch(id, { mode: "in_trade" }), 0);
    },
    [startWatch],
  );

  /** User confirmed exit — reset and arm for a new enter alarm. */
  const confirmExit = useCallback(
    (id: string) => {
      setAlarmPopup(null);
      setBanner(null);
      setWatches((prev) =>
        prev.map((w) =>
          w.id === id
            ? {
                ...w,
                status: "idle",
                metAt: null,
                enteredAt: null,
                exitedAt: null,
                exitEvidence: null,
                lastError: null,
              }
            : w,
        ),
      );
      window.setTimeout(() => startWatch(id, { mode: "hunt" }), 0);
    },
    [startWatch],
  );

  /** Reset a fired (met/exit) watch so it can poll and alarm again. */
  const clearMetStatus = useCallback(
    (id: string, opts?: { restart?: boolean }) => {
      clearTimer(id);
      setAlarmPopup((popup) => (popup?.watch.id === id ? null : popup));
      setWatches((prev) =>
        prev.map((w) =>
          w.id === id &&
          (w.status === "met" || w.status === "exit" || w.status === "in_trade")
            ? {
                ...w,
                status: "idle",
                metAt: null,
                enteredAt: null,
                exitedAt: null,
                exitEvidence: null,
                lastError: null,
              }
            : w,
        ),
      );
      setBanner(null);
      if (opts?.restart) {
        window.setTimeout(() => startWatch(id, { mode: "hunt" }), 0);
      }
    },
    [clearTimer, startWatch],
  );

  const clearAllMetStatuses = useCallback(() => {
    const ids = watchesRef.current
      .filter((w) => w.status === "met" || w.status === "exit" || w.status === "in_trade")
      .map((w) => w.id);
    for (const id of ids) clearTimer(id);
    setAlarmPopup(null);
    setBanner(null);
    setWatches((prev) =>
      prev.map((w) =>
        w.status === "met" || w.status === "exit" || w.status === "in_trade"
          ? {
              ...w,
              status: "idle",
              metAt: null,
              enteredAt: null,
              exitedAt: null,
              exitEvidence: null,
              lastError: null,
            }
          : w,
      ),
    );
  }, [clearTimer]);

  const addWatch = useCallback(
    (input: {
      symbols: string[];
      ruleKeys?: AlarmEligibleRuleKey[];
      ruleKey?: AlarmEligibleRuleKey;
      trend: AlarmTrend;
      bandTimeframe?: "1m" | "15m" | "1h";
      frequencyValue: number;
      frequencyUnit: PollIntervalUnit;
      startAfterAdd?: boolean;
    }) => {
      const symbols = [
        ...new Set(
          input.symbols
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean),
        ),
      ];
      if (symbols.length === 0) {
        setFormError("Pick at least one ticker.");
        return false;
      }
      const ruleKeys = normalizeRuleKeys(
        input.ruleKeys && input.ruleKeys.length > 0
          ? input.ruleKeys
          : input.ruleKey
            ? [input.ruleKey]
            : [],
      );
      if (ruleKeys.length === 0) {
        setFormError("Pick at least one eligible rule.");
        return false;
      }
      const primaryKey = ruleKeys[0]!;
      const onlyBreakout = ruleKeys.length === 1 && primaryKey === "breakout_quality";
      const trend: AlarmTrend = onlyBreakout
        ? "auto"
        : input.trend === "bajista"
          ? "bajista"
          : "alcista";
      if (!onlyBreakout && input.trend !== "alcista" && input.trend !== "bajista") {
        setFormError("Pick a trend (alcista or bajista).");
        return false;
      }
      const frequencyUnit =
        input.frequencyUnit === "hour" || input.frequencyUnit === "sec"
          ? input.frequencyUnit
          : "min";
      const frequencyValue = clampPollInterval(input.frequencyValue, frequencyUnit);
      const sig = ruleKeysSignature(ruleKeys);
      const label = alarmRulesLabel(ruleKeys);

      const existing = watchesRef.current;
      const toAdd: MarketAlarmWatch[] = [];
      const skipped: string[] = [];
      for (const symbol of symbols) {
        const bandTf = ruleKeys.includes("touch_disipador")
          ? input.bandTimeframe ?? "1m"
          : undefined;
        const dup = existing.some((w) => {
          const wKeys =
            w.ruleKeys?.length > 0 ? w.ruleKeys : [w.ruleKey];
          return (
            w.symbol === symbol &&
            ruleKeysSignature(wKeys) === sig &&
            w.trend === trend &&
            (w.bandTimeframe ?? undefined) === bandTf &&
            w.status !== "met"
          );
        });
        if (dup || toAdd.some((w) => w.symbol === symbol)) {
          skipped.push(symbol);
          continue;
        }
        toAdd.push({
          id: `alarm-${Date.now()}-${symbol}-${Math.random().toString(36).slice(2, 7)}`,
          symbol,
          ruleKey: primaryKey,
          ruleKeys,
          ruleLabel: label,
          trend,
          ...(bandTf ? { bandTimeframe: bandTf } : {}),
          frequencyValue,
          frequencyUnit,
          status: "idle",
          lastRuleStatus: null,
          lastEvidence: null,
          lastCheckedAt: null,
          lastError: null,
          metAt: null,
          lastDetectedTrend: null,
          lastRuleResults: null,
        });
      }

      if (toAdd.length === 0) {
        setFormError(
          skipped.length
            ? "Those ticker + rules + trend watches already exist."
            : "Pick at least one ticker.",
        );
        return false;
      }

      setFormError(
        skipped.length
          ? `Added ${toAdd.length}; skipped duplicates: ${skipped.join(", ")}.`
          : null,
      );
      setWatches((prev) => [...toAdd, ...prev]);

      if (input.startAfterAdd) {
        const ids = toAdd.map((w) => w.id);
        window.setTimeout(() => {
          for (const id of ids) startWatch(id);
        }, 0);
      }

      return true;
    },
    [startWatch],
  );

  const startAllIdle = useCallback(() => {
    const ids = watchesRef.current
      .filter((w) => w.status === "idle" || w.status === "stopped" || w.status === "error")
      .map((w) => w.id);
    for (const id of ids) startWatch(id);
  }, [startWatch]);

  const stopAllRunning = useCallback(() => {
    const ids = watchesRef.current
      .filter(
        (w) => w.status === "running" || w.status === "checking" || w.status === "in_trade",
      )
      .map((w) => w.id);
    for (const id of ids) stopWatch(id);
  }, [stopWatch]);

  const requestNotifyPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted" || Notification.permission === "denied") return;
    try {
      await Notification.requestPermission();
    } catch {
      /* ignore */
    }
  }, []);

  const metCount = watches.filter(
    (w) => w.status === "met" || w.status === "exit" || w.status === "in_trade",
  ).length;
  const runningCount = watches.filter(
    (w) => w.status === "running" || w.status === "checking" || w.status === "in_trade",
  ).length;

  return {
    watches,
    tickers,
    tickersLoading,
    tickersError,
    formError,
    banner,
    alarmPopup,
    clearMetBanner,
    clearAlarmPopup,
    confirmEnter,
    confirmExit,
    clearMetStatus,
    clearAllMetStatuses,
    eligibleRules: ALARM_ELIGIBLE_RULES,
    metCount,
    runningCount,
    timeMode,
    setTimeMode,
    simulateLocal,
    setSimulateLocal,
    addWatch,
    startWatch,
    stopWatch,
    startAllIdle,
    stopAllRunning,
    removeWatch,
    updateWatchInterval,
    runCheckNow: runCheck,
    requestNotifyPermission,
  };
}
