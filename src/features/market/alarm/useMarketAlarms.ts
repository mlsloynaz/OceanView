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
import { MarketAlarmApiError, postMarketAlarmCheck, postMarketAlarmScanLastHour, startOrbAutoJob, stopOrbAutoJob, type OrbAutoJobStatus } from "./alarm-client";
import type { MarketAlarmScanLastHourResponse } from "./alarm-client";
import {
  ALARM_ELIGIBLE_RULES,
  alarmRulesLabel,
  alarmWatchConflicts,
  watchRuleKeys,
  usesBreakoutAlarmTarget,
  type AlarmEligibleRuleKey,
  type AlarmPopupKind,
  type AlarmTrend,
  type MarketAlarmWatch,
} from "./alarm-types";
import {
  E03_CONFIRM_EXPIRED_MESSAGE,
  E03_CONFIRM_RULE_KEY,
  isE03ConfirmExpired,
  isE03ConfirmWatch,
} from "./e03-confirm-window";
import {
  SESSION_MONITOR_ENDED_MESSAGE,
  isActivelyMonitoringWatch,
  isSessionMonitorEnded,
} from "./session-monitor-end";
import {
  ORB_WINDOW_CLOSED_MESSAGE,
  ORB5M_WINDOW_CLOSED_MESSAGE,
  ORB5M_WINDOW_END_MINUTES_ET,
  easternClockMinutes,
  isOrbBreakoutWatch,
  isOrb5mBreakoutWatch,
  isOrbAutoWatch,
  isOrb5mAutoWatch,
  isOrbWindowOpen,
  isOrb5mWindowOpen,
  orbWindowMessage,
  orb5mWindowMessage,
} from "./orb-window";
import { diffOrbAutoWatches, orbAutoSymbolsToEnsure } from "./orb-auto-job";
import {
  heldOrbAutoSymbols,
  holdKindForWatch,
  holdOrbAutoSymbol,
  releaseOrbAutoSymbol,
} from "./orb-auto-hold";
import {
  diffOrb5mAutoWatches,
  favoriteOrbSymbols,
  loadOrb5mAutoJob,
  saveOrb5mAutoJob,
  tradeDateEt,
  type Orb5mAutoJobStatus,
} from "./orb5m-auto-job";
import { watchHasBreakout } from "./BreakoutKanbanBoard";
import { schwabRefreshCooldownMs } from "./schwab-refresh";
import {
  armDesktopAlarmAlerts,
  clearDesktopAlarmAlert,
  desktopNotifyPermission,
  requestDesktopNotifyPermission,
  showDesktopAlarmAlert,
} from "./desktop-alarm-notify";
import {
  startAlarmRing,
  stopAlarmRing,
  unlockAlarmAudio,
} from "./play-alarm-bell";
import { appendAlarmTrigger } from "./alarm-trigger-log";
import {
  loadMarketAlarmWatches,
  MARKET_ALARM_CHANGED_EVENT,
  MARKET_ALARM_START_REQUEST_EVENT,
} from "./alarm-watch-storage";

const STORAGE_KEY = "oceanview.market.alarms";
const SIM_STORAGE_KEY = "oceanview.market.alarms.simulate";

/** Migrate watches saved before confirmation_change_trend replaced candle_confirm. */
const LEGACY_ALARM_RULE_KEYS: Record<string, AlarmEligibleRuleKey> = {
  candle_confirm_1h: "confirmation_change_trend_1h",
  candle_confirm_15m: "confirmation_change_trend_15m",
  malu_entry: "trend_change_15m",
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
    row.status === "running" ||
    row.status === "checking" ||
    row.status === "paused" ||
    row.status === "in_trade"
      ? "stopped"
      : row.status;
  return {
    ...row,
    ruleKey,
    ruleKeys: ruleKeys.length > 0 ? ruleKeys : [ruleKey],
    ruleLabel:
      (row.ruleLabel && row.ruleLabel.trim()) ||
      alarmRulesLabel(ruleKeys.length > 0 ? ruleKeys : [ruleKey]),
    trend: "auto",
    status,
  };
}

function loadStored(): MarketAlarmWatch[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MarketAlarmWatch[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => migrateWatch(row))
      .filter((row) => !row.orbAuto && watchRuleKeys(row).length > 0);
  } catch {
    return [];
  }
}

function persist(watches: MarketAlarmWatch[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(watches));
    window.dispatchEvent(new CustomEvent(MARKET_ALARM_CHANGED_EVENT));
  } catch {
    /* ignore quota */
  }
}

export function useMarketAlarms() {
  const [watches, setWatches] = useState<MarketAlarmWatch[]>(() => loadStored());
  const [tickers, setTickers] = useState<CatalogTicker[]>([]);
  const tickersRef = useRef<CatalogTicker[]>([]);
  const [tickersLoading, setTickersLoading] = useState(true);
  const [tickersError, setTickersError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [alarmPopup, setAlarmPopup] = useState<{
    kind: AlarmPopupKind;
    watch: MarketAlarmWatch;
  } | null>(null);
  const alarmPopupRef = useRef(alarmPopup);
  alarmPopupRef.current = alarmPopup;
  const [timeMode, setTimeMode] = useState<LiveSimulateMode>(() => {
    try {
      return sessionStorage.getItem(SIM_STORAGE_KEY) === "simulate" ? "simulate" : "live";
    } catch {
      return "live";
    }
  });
  const [simulateLocal, setSimulateLocal] = useState(() => formatEtDatetimeLocal(new Date()));
  const [lastHourScan, setLastHourScan] = useState<MarketAlarmScanLastHourResponse | null>(null);
  const [lastHourScanError, setLastHourScanError] = useState<string | null>(null);
  const [lastHourScanBusy, setLastHourScanBusy] = useState(false);
  const [notifyPermission, setNotifyPermission] = useState<
    NotificationPermission | "unsupported"
  >(() => desktopNotifyPermission());
  const [orbAutoJob, setOrbAutoJob] = useState<OrbAutoJobStatus | null>(null);
  const [orb5mAutoJob, setOrb5mAutoJob] = useState<Orb5mAutoJobStatus | null>(() =>
    loadOrb5mAutoJob(),
  );
  const [orbAutoBusy, setOrbAutoBusy] = useState(false);
  const [orb5mAutoBusy, setOrb5mAutoBusy] = useState(false);

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
  tickersRef.current = tickers;
  const timeModeRef = useRef(timeMode);
  timeModeRef.current = timeMode;
  const simulateLocalRef = useRef(simulateLocal);
  simulateLocalRef.current = simulateLocal;
  const orb5mAutoSyncBusyRef = useRef(false);

  const assessmentClock = useCallback((): Date => {
    if (timeModeRef.current === "simulate") {
      return parseEtDatetimeLocal(simulateLocalRef.current) ?? new Date();
    }
    return new Date();
  }, []);

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

  const dropWatchFromQueues = useCallback(
    (id: string) => {
      clearTimer(id);
      queuedIdsRef.current.delete(id);
      checkQueueRef.current = checkQueueRef.current.filter((queued) => queued !== id);
    },
    [clearTimer],
  );

  const sweepExpiredE03Confirms = useCallback(() => {
    const now = assessmentClock();
    if (!isE03ConfirmExpired(now)) return;

    const expired = watchesRef.current.filter(isE03ConfirmWatch);
    if (expired.length === 0) return;

    for (const watch of expired) {
      dropWatchFromQueues(watch.id);
    }
    setAlarmPopup((popup) => {
      if (popup && isE03ConfirmWatch(popup.watch)) {
        stopAlarmRing();
        clearDesktopAlarmAlert();
        return null;
      }
      return popup;
    });
    setWatches((prev) => prev.filter((w) => !isE03ConfirmWatch(w)));
    setBanner(E03_CONFIRM_EXPIRED_MESSAGE);
  }, [assessmentClock, dropWatchFromQueues]);

  const stopWatchesAtSessionEnd = useCallback(() => {
    const now = assessmentClock();
    if (!isSessionMonitorEnded(now)) return;
    const active = watchesRef.current.filter(isActivelyMonitoringWatch);
    if (active.length === 0) return;
    for (const watch of active) {
      dropWatchFromQueues(watch.id);
    }
    stopAlarmRing();
    clearDesktopAlarmAlert();
    setAlarmPopup(null);
    setWatches((prev) =>
      prev.map((w) =>
        isActivelyMonitoringWatch(w)
          ? { ...w, status: "stopped", lastError: null }
          : w,
      ),
    );
    setBanner(SESSION_MONITOR_ENDED_MESSAGE);
  }, [assessmentClock, dropWatchFromQueues]);

  useEffect(() => {
    return () => stopAllTimers();
  }, [stopAllTimers]);

  useEffect(() => {
    sweepExpiredE03Confirms();
    stopWatchesAtSessionEnd();
    const timer = window.setInterval(() => {
      sweepExpiredE03Confirms();
      stopWatchesAtSessionEnd();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [sweepExpiredE03Confirms, stopWatchesAtSessionEnd, timeMode, simulateLocal]);

  /**
   * One Schwab pull per ticker. Cooldown is the shortest interval among alarms
   * that are actually polling that symbol. Another ticker keeps its own interval.
   * The slot is claimed immediately so two alarms firing together do not both call Schwab.
   */
  const shouldRefreshCandles = useCallback((symbol: string) => {
    const upper = symbol.toUpperCase();
    const last = lastCandleRefreshRef.current.get(upper) ?? 0;
    const intervals = watchesRef.current
      .filter(
        (w) =>
          w.symbol === upper &&
          (w.status === "running" ||
            w.status === "checking" ||
            w.status === "in_trade" ||
            timersRef.current.has(w.id)),
      )
      .map((w) => pollIntervalToMs(w.frequencyValue, w.frequencyUnit));
    const cooldown = schwabRefreshCooldownMs(intervals);
    if (Date.now() - last < cooldown) return false;
    lastCandleRefreshRef.current.set(upper, Date.now());
    return true;
  }, []);

  const releaseCandleRefresh = useCallback((symbol: string) => {
    lastCandleRefreshRef.current.delete(symbol.toUpperCase());
  }, []);

  const executeCheck = useCallback(
    async (id: string) => {
      const watch = watchesRef.current.find((w) => w.id === id);
      // Waiting for user on enter/exit popup — do not poll.
      if (!watch || watch.status === "met" || watch.status === "exit") return;
      if (isE03ConfirmWatch(watch) && isE03ConfirmExpired(assessmentClock())) {
        sweepExpiredE03Confirms();
        return;
      }
      if (isSessionMonitorEnded(assessmentClock())) {
        stopWatchesAtSessionEnd();
        return;
      }

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
          ...(usesBreakoutAlarmTarget(ruleKeys)
            ? { alarmTarget: watch.alarmTarget ?? "entry_ready" }
            : {}),
        });

        const candleFailed =
          result.candle?.status === "failed" ||
          (result.candle as { outcome?: string } | null | undefined)?.outcome === "failed";
        if (!simulating && refreshCandles && (candleFailed || result.paused)) {
          releaseCandleRefresh(watch.symbol);
        }

        // Outside market hours — keep timer; resume automatically at next open.
        if (result.paused) {
          const waitMsg =
            result.message ||
            result.evidence ||
            "I am sorry wait for Market hours";
          setWatches((prev) =>
            prev.map((w) =>
              w.id === id
                ? {
                    ...w,
                    status: priorStatus === "in_trade" ? "in_trade" : "paused",
                    lastRuleStatus: "paused",
                    lastEvidence: waitMsg,
                    lastCheckedAt: result.checkedAt,
                    lastError: null,
                    lastRuleResults: result.ruleResults ?? null,
                  }
                : w,
            ),
          );
          setBanner(waitMsg);
          return;
        }

        if (result.expired && isE03ConfirmWatch(watch)) {
          sweepExpiredE03Confirms();
          return;
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
          lastContinuationScore:
            typeof result.continuationScore === "number"
              ? result.continuationScore
              : (watch.lastContinuationScore ?? null),
          lastContinuationMomentumScore:
            typeof result.continuationMomentumScore === "number"
              ? result.continuationMomentumScore
              : (watch.lastContinuationMomentumScore ?? null),
          lastContinuationEntryScore:
            typeof result.continuationEntryScore === "number"
              ? result.continuationEntryScore
              : (watch.lastContinuationEntryScore ?? null),
          lastLifecycle:
            typeof result.lifecycle === "string"
              ? result.lifecycle
              : (watch.lastLifecycle ?? null),
          lastBreakoutType:
            typeof result.breakoutType === "string"
              ? result.breakoutType
              : (watch.lastBreakoutType ?? null),
          lastSetupType:
            typeof result.setupType === "string"
              ? result.setupType
              : (watch.lastSetupType ?? null),
          lastBbSparkline15m:
            result.bbSparkline15m && Array.isArray(result.bbSparkline15m.bars)
              ? result.bbSparkline15m
              : (watch.lastBbSparkline15m ?? null),
          lastBreakoutLevel:
            typeof result.breakoutLevel === "number"
              ? result.breakoutLevel
              : (watch.lastBreakoutLevel ?? null),
          lastAboveVwap:
            typeof result.aboveVwap === "boolean"
              ? result.aboveVwap
              : (watch.lastAboveVwap ?? null),
          lastOverextended:
            typeof result.overextended === "boolean"
              ? result.overextended
              : (watch.lastOverextended ?? null),
          lastLateEntry:
            typeof result.lateEntry === "boolean"
              ? result.lateEntry
              : (watch.lastLateEntry ?? null),
          lastEntryBlockers: Array.isArray(result.entryBlockers)
            ? result.entryBlockers
            : (watch.lastEntryBlockers ?? null),
          lastEntryPath:
            typeof result.entryPath === "string"
              ? result.entryPath
              : (watch.lastEntryPath ?? null),
          lastAcceptanceScore:
            typeof result.acceptanceScore === "number"
              ? result.acceptanceScore
              : (watch.lastAcceptanceScore ?? null),
          lastImpulseScore:
            typeof result.impulseScore === "number"
              ? result.impulseScore
              : (watch.lastImpulseScore ?? null),
          lastWarnings: Array.isArray(result.warnings)
            ? result.warnings
            : (watch.lastWarnings ?? null),
          lastBrokenNow:
            typeof result.brokenNow === "boolean"
              ? result.brokenNow
              : (watch.lastBrokenNow ?? null),
          lastTrend1h:
            typeof result.trend1h === "string"
              ? result.trend1h
              : (watch.lastTrend1h ?? null),
          lastGrade:
            typeof result.grade === "string"
              ? result.grade
              : (watch.lastGrade ?? null),
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
          void appendAlarmTrigger(exitWatch, "exit").catch(() => {
            /* list refresh is best-effort; popup/sound still fire */
          });
          setBanner(
            `${result.symbol} · ${watch.ruleLabel} (${sideLabel}) EXIT — setup gone.${simSuffix}`,
          );
          setAlarmPopup({ kind: "exit", watch: exitWatch });
          startAlarmRing();
          showDesktopAlarmAlert({
            kind: "exit",
            symbol: watch.symbol,
            title: `Exit: ${watch.symbol}`,
            body: `${watch.ruleLabel} · ${sideLabel} — exit now`,
            tag: `ov-market-alarm-exit-${watch.id}`,
          });
          return;
        }

        // Dismissed EXIT — wait until the setup is unmet before a new ENTER popup.
        if (watch.suppressEnterUntilUnmet) {
          if (!result.met) {
            setWatches((prev) =>
              prev.map((w) =>
                w.id === id
                  ? { ...w, ...patchBase, status: "running", suppressEnterUntilUnmet: false }
                  : w,
              ),
            );
            return;
          }
          setWatches((prev) =>
            prev.map((w) =>
              w.id === id
                ? { ...w, ...patchBase, status: "running", suppressEnterUntilUnmet: true }
                : w,
            ),
          );
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
          void appendAlarmTrigger(metWatch, "enter").catch(() => {
            /* list refresh is best-effort; popup/sound still fire */
          });
          setBanner(
            `${result.symbol} · ${watch.ruleLabel} (${sideLabel}) ENTER — rule met.${simSuffix}`,
          );
          setAlarmPopup({ kind: "enter", watch: metWatch });
          // Entry alarm: ring until confirm / dismiss / clear.
          startAlarmRing();
          showDesktopAlarmAlert({
            kind: "enter",
            symbol: watch.symbol,
            title: `Enter: ${watch.symbol}`,
            body: `${watch.ruleLabel} · ${sideLabel} — enter now`,
            tag: `ov-market-alarm-enter-${watch.id}`,
          });
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
        if (refreshCandles) releaseCandleRefresh(watch.symbol);
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
    [assessmentClock, clearTimer, releaseCandleRefresh, shouldRefreshCandles, stopWatchesAtSessionEnd, sweepExpiredE03Confirms],
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
      unlockAlarmAudio();
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
      if (isE03ConfirmWatch(watch) && isE03ConfirmExpired(assessmentClock())) {
        sweepExpiredE03Confirms();
        return;
      }
      if (
        isOrbBreakoutWatch(watch) &&
        !isOrbAutoWatch(watch) &&
        !isOrbWindowOpen(assessmentClock())
      ) {
        setFormError(orbWindowMessage(assessmentClock()) ?? ORB_WINDOW_CLOSED_MESSAGE);
        return;
      }
      if (
        isOrb5mBreakoutWatch(watch) &&
        !isOrb5mAutoWatch(watch) &&
        !isOrb5mWindowOpen(assessmentClock())
      ) {
        setFormError(orb5mWindowMessage(assessmentClock()) ?? ORB5M_WINDOW_CLOSED_MESSAGE);
        return;
      }
      if (isSessionMonitorEnded(assessmentClock())) {
        stopWatchesAtSessionEnd();
        return;
      }
      // Enter confirm may still see status "met" until state flushes.
      if (watch.status === "met" && opts?.mode !== "in_trade") return;
      if (watch.status === "exit" && opts?.mode !== "hunt") return;

      const mode =
        opts?.mode ?? (watch.status === "in_trade" ? "in_trade" : "hunt");

      unlockAlarmAudio();
      armDesktopAlarmAlerts();
      const holdKind = holdKindForWatch(watch);
      if (holdKind) releaseOrbAutoSymbol(holdKind, watch.symbol);
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
    [assessmentClock, clearTimer, runCheck, stopWatchesAtSessionEnd, sweepExpiredE03Confirms],
  );

  const removeOrbAutoWatches = useCallback(() => {
    const autoRows = watchesRef.current.filter(isOrbAutoWatch);
    if (autoRows.length === 0) return;
    for (const watch of autoRows) {
      dropWatchFromQueues(watch.id);
    }
    setWatches((prev) => prev.filter((w) => !isOrbAutoWatch(w)));
  }, [dropWatchFromQueues]);

  const ensureOrbAutoWatches = useCallback(
    (symbols: string[], pollIntervalSeconds: number) => {
      const held = heldOrbAutoSymbols("orb15");
      const { toAdd, toRemoveIds } = diffOrbAutoWatches(
        watchesRef.current,
        symbols,
        pollIntervalSeconds,
        held,
      );
      if (toRemoveIds.length === 0 && toAdd.length === 0) {
        for (const watch of watchesRef.current.filter(isOrbAutoWatch)) {
          if (held.has(watch.symbol)) continue;
          if (watch.status === "idle" || watch.status === "stopped" || watch.status === "error") {
            startWatch(watch.id);
          }
        }
        return;
      }
      for (const id of toRemoveIds) {
        dropWatchFromQueues(id);
      }
      const next = [
        ...watchesRef.current.filter((w) => !toRemoveIds.includes(w.id)),
        ...toAdd,
      ];
      watchesRef.current = next;
      setWatches(next);
      for (const watch of toAdd) {
        window.setTimeout(() => startWatch(watch.id), 0);
      }
      for (const watch of next.filter(isOrbAutoWatch)) {
        if (held.has(watch.symbol)) continue;
        if (
          !toAdd.some((row) => row.id === watch.id) &&
          (watch.status === "idle" || watch.status === "stopped" || watch.status === "error")
        ) {
          window.setTimeout(() => startWatch(watch.id), 0);
        }
      }
    },
    [dropWatchFromQueues, startWatch],
  );

  const cancelOrbAutoJob = useCallback(async () => {
    removeOrbAutoWatches();
    try {
      const status = await stopOrbAutoJob("cancelled");
      setOrbAutoJob(status);
      setBanner(status.message ?? "ORB auto cancelled — use manual ticker selection.");
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Failed to cancel ORB auto job.");
    }
  }, [removeOrbAutoWatches]);

  const startOrbAutoJobManual = useCallback(
    async (symbols: string[]) => {
      armDesktopAlarmAlerts();
      setOrbAutoBusy(true);
      try {
        const cleaned = orbAutoSymbolsToEnsure(symbols);
        const status = await startOrbAutoJob({ symbols: cleaned, trigger: "manual" });
        setOrbAutoJob(status);
        if (status.status === "running") {
          ensureOrbAutoWatches(cleaned, status.pollIntervalSeconds ?? 45);
        }
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Failed to start 15m ORB auto.");
      } finally {
        setOrbAutoBusy(false);
      }
    },
    [ensureOrbAutoWatches],
  );

  const removeOrb5mAutoWatches = useCallback(() => {
    const autoRows = watchesRef.current.filter(isOrb5mAutoWatch);
    if (autoRows.length === 0) return;
    for (const watch of autoRows) {
      dropWatchFromQueues(watch.id);
    }
    setWatches((prev) => prev.filter((w) => !isOrb5mAutoWatch(w)));
  }, [dropWatchFromQueues]);

  const ensureOrb5mAutoWatches = useCallback(
    (symbols: string[], pollIntervalSeconds: number) => {
      const held = heldOrbAutoSymbols("orb5m");
      const { toAdd, toRemoveIds } = diffOrb5mAutoWatches(
        watchesRef.current,
        symbols,
        pollIntervalSeconds,
        held,
      );
      if (toRemoveIds.length === 0 && toAdd.length === 0) {
        for (const watch of watchesRef.current.filter(isOrb5mAutoWatch)) {
          if (held.has(watch.symbol)) continue;
          if (watch.status === "idle" || watch.status === "stopped" || watch.status === "error") {
            startWatch(watch.id);
          }
        }
        return;
      }
      for (const id of toRemoveIds) {
        dropWatchFromQueues(id);
      }
      const next = [
        ...watchesRef.current.filter((w) => !toRemoveIds.includes(w.id)),
        ...toAdd,
      ];
      watchesRef.current = next;
      setWatches(next);
      for (const watch of toAdd) {
        window.setTimeout(() => startWatch(watch.id), 0);
      }
      for (const watch of next.filter(isOrb5mAutoWatch)) {
        if (held.has(watch.symbol)) continue;
        if (
          !toAdd.some((row) => row.id === watch.id) &&
          (watch.status === "idle" || watch.status === "stopped" || watch.status === "error")
        ) {
          window.setTimeout(() => startWatch(watch.id), 0);
        }
      }
    },
    [dropWatchFromQueues, startWatch],
  );

  const startOrb5mAutoJob = useCallback(
    (_symbols: string[]) => {
      armDesktopAlarmAlerts();
      const now = assessmentClock();
      if (!isOrb5mWindowOpen(now)) {
        setFormError(orb5mWindowMessage(now) ?? ORB5M_WINDOW_CLOSED_MESSAGE);
        return;
      }
      const existing = loadOrb5mAutoJob(now);
      if (existing.status === "cancelled" && existing.tradeDate === tradeDateEt(now)) {
        setFormError("5m ORB auto was cancelled for today — add a manual watch or wait until tomorrow.");
        return;
      }
      setOrb5mAutoBusy(true);
      try {
        const favorites = favoriteOrbSymbols(tickersRef.current);
        if (favorites.length === 0) {
          setFormError("No favorite tickers. Mark tickers as favorites for 5m ORB auto.");
          return;
        }
        const job = saveOrb5mAutoJob({
          jobType: "orb5m_auto_monitor",
          kind: "orb5m_auto_monitor",
          status: "running",
          symbols: favorites,
          tradeDate: tradeDateEt(now),
          message: `5m ORB auto running — ${favorites.join(", ")} (9:35–11:30 ET).`,
          windowOpen: true,
          pollIntervalSeconds: 30,
        });
        setOrb5mAutoJob(job);
        ensureOrb5mAutoWatches(favorites, 30);
      } finally {
        setOrb5mAutoBusy(false);
      }
    },
    [assessmentClock, ensureOrb5mAutoWatches],
  );

  const cancelOrb5mAutoJob = useCallback(() => {
    removeOrb5mAutoWatches();
    const now = assessmentClock();
    const prev = loadOrb5mAutoJob(now);
    const job = saveOrb5mAutoJob({
      ...prev,
      status: "cancelled",
      tradeDate: tradeDateEt(now),
      message: "5m ORB auto cancelled — use manual ticker selection.",
      windowOpen: isOrb5mWindowOpen(now),
    });
    setOrb5mAutoJob(job);
    setBanner(job.message);
  }, [assessmentClock, removeOrb5mAutoWatches]);

  const syncOrb5mAutoJob = useCallback(() => {
    if (timeModeRef.current !== "live") return;
    if (orb5mAutoSyncBusyRef.current) return;
    orb5mAutoSyncBusyRef.current = true;
    try {
      const now = assessmentClock();
      const mins = easternClockMinutes(now);
      let job = loadOrb5mAutoJob(now);
      if (mins > ORB5M_WINDOW_END_MINUTES_ET) {
        if (job.status === "running") {
          job = saveOrb5mAutoJob({
            ...job,
            status: "completed",
            message: "5m ORB window ended — auto job completed.",
            windowOpen: false,
          });
        }
        setOrb5mAutoJob(job);
        removeOrb5mAutoWatches();
        return;
      }
      if (!isOrb5mWindowOpen(now)) {
        setOrb5mAutoJob(job);
        return;
      }
      if (job.status === "cancelled") {
        setOrb5mAutoJob(job);
        removeOrb5mAutoWatches();
        return;
      }
      const favorites = favoriteOrbSymbols(tickersRef.current);
      if (favorites.length === 0) {
        setOrb5mAutoJob(job);
        return;
      }
      job = saveOrb5mAutoJob({
        ...job,
        status: "running",
        symbols: favorites,
        tradeDate: tradeDateEt(now),
        message: `5m ORB auto running — ${favorites.join(", ")} (9:35–11:30 ET).`,
        windowOpen: true,
      });
      setOrb5mAutoJob(job);
      ensureOrb5mAutoWatches(favorites, job.pollIntervalSeconds);
    } finally {
      orb5mAutoSyncBusyRef.current = false;
    }
  }, [assessmentClock, ensureOrb5mAutoWatches, removeOrb5mAutoWatches]);

  useEffect(() => {
    removeOrbAutoWatches();
  }, [removeOrbAutoWatches]);

  useEffect(() => {
    if (timeMode !== "live") return;
    syncOrb5mAutoJob();
    const timer = window.setInterval(() => syncOrb5mAutoJob(), 30_000);
    return () => window.clearInterval(timer);
  }, [timeMode, syncOrb5mAutoJob]);

  /** SemiFinal (and other tabs) can enqueue confirm watches into sessionStorage. */
  useEffect(() => {
    const mergeFromStore = () => {
      const fromStore = loadMarketAlarmWatches().map((row) => migrateWatch(row));
      const prev = watchesRef.current;
      const ids = new Set(prev.map((w) => w.id));
      const newcomers = fromStore.filter((w) => !ids.has(w.id));
      if (newcomers.length === 0) return;
      const next = [...newcomers, ...prev];
      watchesRef.current = next;
      setWatches(next);
    };

    const onChanged = () => {
      mergeFromStore();
      sweepExpiredE03Confirms();
      stopWatchesAtSessionEnd();
    };
    const onStart = (e: Event) => {
      const watchId = (e as CustomEvent<{ watchId?: string }>).detail?.watchId;
      mergeFromStore();
      sweepExpiredE03Confirms();
      stopWatchesAtSessionEnd();
      if (watchId) {
        window.setTimeout(() => startWatch(watchId), 0);
      }
    };

    window.addEventListener(MARKET_ALARM_CHANGED_EVENT, onChanged);
    window.addEventListener(MARKET_ALARM_START_REQUEST_EVENT, onStart);
    return () => {
      window.removeEventListener(MARKET_ALARM_CHANGED_EVENT, onChanged);
      window.removeEventListener(MARKET_ALARM_START_REQUEST_EVENT, onStart);
    };
  }, [startWatch, stopWatchesAtSessionEnd, sweepExpiredE03Confirms]);

  const stopWatch = useCallback(
    (id: string) => {
      const watch = watchesRef.current.find((w) => w.id === id);
      clearTimer(id);
      const holdKind = watch ? holdKindForWatch(watch) : null;
      if (watch && holdKind) holdOrbAutoSymbol(holdKind, watch.symbol);
      setWatches((prev) =>
        prev.map((w) =>
          w.id === id &&
          w.status !== "met" &&
          w.status !== "exit"
            ? { ...w, status: "stopped" }
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
      if (watch && (watch.status === "running" || watch.status === "checking" || watch.status === "paused" || watch.status === "in_trade")) {
        clearTimer(id);
        const ms = pollIntervalToMs(nextValue, nextUnit);
        const timer = window.setInterval(() => void runCheck(id), ms);
        timersRef.current.set(id, timer);
      }
    },
    [clearTimer, runCheck],
  );

  const removeWatches = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      const removing = watchesRef.current.filter((watch) => idSet.has(watch.id));
      if (removing.length === 0) return;
      const cancel5m = removing.some((watch) => watch.orb5mAuto);
      for (const watch of removing) {
        clearTimer(watch.id);
        dropWatchFromQueues(watch.id);
      }
      setAlarmPopup((popup) => {
        if (popup && idSet.has(popup.watch.id)) {
          stopAlarmRing();
          clearDesktopAlarmAlert();
          return null;
        }
        return popup;
      });
      setWatches((prev) => prev.filter((watch) => !idSet.has(watch.id)));
      if (cancel5m) {
        const now = assessmentClock();
        const prev = loadOrb5mAutoJob(now);
        setOrb5mAutoJob(
          saveOrb5mAutoJob({
            ...prev,
            status: "cancelled",
            tradeDate: tradeDateEt(now),
            symbols: [],
            message: "5m ORB auto cancelled — tickers removed.",
            windowOpen: isOrb5mWindowOpen(now),
          }),
        );
      }
    },
    [assessmentClock, clearTimer, dropWatchFromQueues],
  );

  const removeWatch = useCallback(
    (id: string) => {
      const watch = watchesRef.current.find((w) => w.id === id);
      clearTimer(id);
      const holdKind = watch ? holdKindForWatch(watch) : null;
      if (watch && holdKind) holdOrbAutoSymbol(holdKind, watch.symbol);
      if (watch?.orb5mAuto) {
        const job = loadOrb5mAutoJob();
        const symbols = job.symbols.filter((s) => s !== watch.symbol);
        setOrb5mAutoJob(saveOrb5mAutoJob({ ...job, symbols }));
      }
      setAlarmPopup((popup) => {
        if (popup?.watch.id === id) {
          stopAlarmRing();
          clearDesktopAlarmAlert();
          return null;
        }
        return popup;
      });
      setWatches((prev) => prev.filter((w) => w.id !== id));
    },
    [clearTimer],
  );

  const clearMetBanner = useCallback(() => setBanner(null), []);
  const clearAlarmPopup = useCallback(() => {
    stopAlarmRing();
    clearDesktopAlarmAlert();
    setAlarmPopup(null);
  }, []);

  /** Dismiss = already notified. Stop sound/overlay and do not show this signal again. */
  const dismissAlarmPopup = useCallback(() => {
    const popup = alarmPopupRef.current;
    stopAlarmRing();
    clearDesktopAlarmAlert();
    setAlarmPopup(null);
    setBanner(null);
    if (!popup) return;
    if (popup.kind === "enter") {
      const now = new Date().toISOString();
      setWatches((prev) =>
        prev.map((w) =>
          w.id === popup.watch.id
            ? {
                ...w,
                status: "in_trade",
                enteredAt: now,
                exitedAt: null,
                exitEvidence: null,
                lastError: null,
                suppressEnterUntilUnmet: false,
              }
            : w,
        ),
      );
      window.setTimeout(() => startWatch(popup.watch.id, { mode: "in_trade" }), 0);
      return;
    }
    setWatches((prev) =>
      prev.map((w) =>
        w.id === popup.watch.id
          ? {
              ...w,
              status: "idle",
              metAt: null,
              enteredAt: null,
              exitedAt: null,
              exitEvidence: null,
              lastError: null,
              suppressEnterUntilUnmet: true,
            }
          : w,
      ),
    );
    window.setTimeout(() => startWatch(popup.watch.id, { mode: "hunt" }), 0);
  }, [startWatch]);

  /** User confirmed enter — keep polling until setup drops (exit). */
  const confirmEnter = useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      stopAlarmRing();
      clearDesktopAlarmAlert();
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
      stopAlarmRing();
      clearDesktopAlarmAlert();
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
      setAlarmPopup((popup) => {
        if (popup?.watch.id === id) {
          stopAlarmRing();
          clearDesktopAlarmAlert();
          return null;
        }
        return popup;
      });
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
    stopAlarmRing();
    clearDesktopAlarmAlert();
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
      /** Ignored — alarms always use auto; rules set direction. */
      trend?: AlarmTrend;
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
      if (ruleKeys.includes(E03_CONFIRM_RULE_KEY) && isE03ConfirmExpired(assessmentClock())) {
        setFormError(E03_CONFIRM_EXPIRED_MESSAGE);
        sweepExpiredE03Confirms();
        return false;
      }
      if (isSessionMonitorEnded(assessmentClock())) {
        setFormError(SESSION_MONITOR_ENDED_MESSAGE);
        stopWatchesAtSessionEnd();
        return false;
      }
      const primaryKey = ruleKeys[0]!;
      const trend: AlarmTrend = "auto";
      const frequencyUnit =
        input.frequencyUnit === "hour" || input.frequencyUnit === "sec"
          ? input.frequencyUnit
          : "min";
      const frequencyValue = clampPollInterval(input.frequencyValue, frequencyUnit);
      const label = alarmRulesLabel(ruleKeys);

      const existing = watchesRef.current;
      const toAdd: MarketAlarmWatch[] = [];
      const skipped: string[] = [];
      for (const symbol of symbols) {
        const bandTf = undefined;
        const dup =
          alarmWatchConflicts(existing, {
            symbol,
            ruleKeys,
            bandTimeframe: bandTf,
          }) ||
          toAdd.some((w) => w.symbol === symbol);
        if (dup) {
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
          ...(usesBreakoutAlarmTarget(ruleKeys)
            ? { alarmTarget: "entry_ready" as const }
            : {}),
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
          lastLifecycle: null,
          lastBreakoutScore: null,
          lastContinuationScore: null,
          lastContinuationMomentumScore: null,
          lastContinuationEntryScore: null,
          lastBreakoutType: null,
          lastSetupType: null,
          lastBbSparkline15m: null,
          lastBreakoutLevel: null,
          lastAboveVwap: null,
          lastOverextended: null,
          lastLateEntry: null,
          lastEntryBlockers: null,
          lastWarnings: null,
        });
      }

      if (toAdd.length === 0) {
        setFormError(
          skipped.length
            ? "Those ticker + rules watches already exist."
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
        armDesktopAlarmAlerts();
        const ids = toAdd.map((w) => w.id);
        window.setTimeout(() => {
          for (const id of ids) startWatch(id);
        }, 0);
      }

      return true;
    },
    [assessmentClock, startWatch, stopWatchesAtSessionEnd, sweepExpiredE03Confirms, removeOrbAutoWatches],
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
        (w) =>
          w.status === "running" ||
          w.status === "checking" ||
          w.status === "paused" ||
          w.status === "in_trade",
      )
      .map((w) => w.id);
    for (const id of ids) stopWatch(id);
  }, [stopWatch]);

  const requestNotifyPermission = useCallback(async () => {
    unlockAlarmAudio();
    armDesktopAlarmAlerts();
    const perm = await requestDesktopNotifyPermission();
    setNotifyPermission(perm);
  }, []);

  const scanLastHourRth = useCallback(
    async (symbolHint?: string) => {
      const hint = (symbolHint || "").trim().toUpperCase();
      const breakout = watchesRef.current.filter(watchHasBreakout);
      const pool = breakout.length > 0 ? breakout : watchesRef.current;
      const symbol =
        hint ||
        pool[0]?.symbol ||
        "";
      if (!symbol) {
        setLastHourScanError("Add a breakout watch (or any watch) first, then scan.");
        setLastHourScan(null);
        return;
      }
      const watch =
        pool.find((w) => w.symbol === symbol) ??
        watchesRef.current.find((w) => w.symbol === symbol) ??
        pool[0];
      const ruleKeys = watch
        ? watch.ruleKeys?.length
          ? watch.ruleKeys
          : [watch.ruleKey]
        : (["breakout_quality"] as AlarmEligibleRuleKey[]);
      const trend = watch?.trend ?? "auto";

      setLastHourScanBusy(true);
      setLastHourScanError(null);
      try {
        const result = await postMarketAlarmScanLastHour({
          symbol,
          ruleKeys,
          trend,
          stepMinutes: 15,
          refreshCandles: false,
          ...(watch?.bandTimeframe ? { bandTimeframe: watch.bandTimeframe } : {}),
        });
        setLastHourScan(result);
        setTimeMode("simulate");
        const jump = result.firstEntryAt || result.firstConfirmedAt || result.windowEndEt;
        if (jump) {
          const d = new Date(jump);
          if (!Number.isNaN(d.getTime())) {
            setSimulateLocal(formatEtDatetimeLocal(d));
          }
        }
      } catch (err) {
        const msg =
          err instanceof MarketAlarmApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Last-hour scan failed.";
        setLastHourScanError(msg);
        setLastHourScan(null);
      } finally {
        setLastHourScanBusy(false);
      }
    },
    [setTimeMode],
  );

  const clearLastHourScan = useCallback(() => {
    setLastHourScan(null);
    setLastHourScanError(null);
  }, []);

  useEffect(() => {
    return () => {
      stopAlarmRing();
      clearDesktopAlarmAlert();
    };
  }, []);
  const metCount = watches.filter(
    (w) => w.status === "met" || w.status === "exit" || w.status === "in_trade",
  ).length;
  const runningCount = watches.filter(
    (w) =>
      w.status === "running" ||
      w.status === "checking" ||
      w.status === "paused" ||
      w.status === "in_trade",
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
    lastHourScan,
    lastHourScanError,
    lastHourScanBusy,
    scanLastHourRth,
    clearLastHourScan,
    addWatch,
    startWatch,
    stopWatch,
    startAllIdle,
    stopAllRunning,
    removeWatch,
    removeWatches,
    updateWatchInterval,
    runCheckNow: runCheck,
    requestNotifyPermission,
    notifyPermission,
    dismissAlarmPopup,
    orbAutoJob,
    cancelOrbAutoJob,
    startOrbAutoJobManual,
    orbAutoBusy,
    orb5mAutoJob,
    startOrb5mAutoJob,
    cancelOrb5mAutoJob,
    orb5mAutoBusy,
  };
}
