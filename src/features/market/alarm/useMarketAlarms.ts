import { useCallback, useEffect, useRef, useState } from "react";
import { getActiveTickersForAdmin } from "@/features/admin/tickers/api/tickers-client";
import type { CatalogTicker } from "@/features/admin/tickers/types";
import {
  clampPollInterval,
  pollIntervalToMs,
  type PollIntervalUnit,
} from "@/shared/components/PollControls";
import { MarketAlarmApiError, postMarketAlarmCheck } from "./alarm-client";
import {
  ALARM_ELIGIBLE_RULES,
  alarmRuleLabel,
  type AlarmEligibleRuleKey,
  type AlarmTrend,
  type MarketAlarmWatch,
} from "./alarm-types";
import { playAlarmBell } from "./play-alarm-bell";

const STORAGE_KEY = "oceanview.market.alarms";

function loadStored(): MarketAlarmWatch[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MarketAlarmWatch[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row) => ({
      ...row,
      status: row.status === "running" || row.status === "checking" ? "stopped" : row.status,
    }));
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
  const [metPopup, setMetPopup] = useState<MarketAlarmWatch | null>(null);

  const timersRef = useRef<Map<string, number>>(new Map());
  const inFlightRef = useRef<Set<string>>(new Set());
  /** Per-symbol candle refresh timestamps — avoid duplicate Schwab pulls. */
  const lastCandleRefreshRef = useRef<Map<string, number>>(new Map());
  const watchesRef = useRef(watches);
  watchesRef.current = watches;

  useEffect(() => {
    persist(watches);
  }, [watches]);

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

  /** Skip candle refresh if same symbol was refreshed recently (shared across watches). */
  const shouldRefreshCandles = useCallback((symbol: string) => {
    const upper = symbol.toUpperCase();
    const last = lastCandleRefreshRef.current.get(upper) ?? 0;
    const sameSymbolWatches = watchesRef.current.filter(
      (w) =>
        w.symbol === upper &&
        (w.status === "running" || w.status === "checking" || timersRef.current.has(w.id)),
    );
    let minMs = 25_000;
    for (const w of sameSymbolWatches) {
      const ms = pollIntervalToMs(w.frequencyValue, w.frequencyUnit);
      if (ms > 0 && ms < minMs) minMs = ms;
    }
    // Refresh at most as often as the fastest watch on this symbol (floor 15s).
    const cooldown = Math.max(15_000, Math.min(minMs, 60_000));
    return Date.now() - last >= cooldown;
  }, []);

  const markCandleRefreshed = useCallback((symbol: string) => {
    lastCandleRefreshRef.current.set(symbol.toUpperCase(), Date.now());
  }, []);

  const runCheck = useCallback(
    async (id: string) => {
      if (inFlightRef.current.has(id)) return;
      const watch = watchesRef.current.find((w) => w.id === id);
      if (!watch || watch.status === "met") return;

      inFlightRef.current.add(id);
      setWatches((prev) =>
        prev.map((w) => (w.id === id ? { ...w, status: "checking", lastError: null } : w)),
      );

      const refreshCandles = shouldRefreshCandles(watch.symbol);

      try {
        const result = await postMarketAlarmCheck({
          symbol: watch.symbol,
          ruleKey: watch.ruleKey,
          trend: watch.trend,
          refreshCandles,
          ...(watch.bandTimeframe ? { bandTimeframe: watch.bandTimeframe } : {}),
        });

        if (refreshCandles && result.candle?.status !== "failed") {
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

        if (result.met) {
          clearTimer(id);
          const metWatch: MarketAlarmWatch = {
            ...watch,
            status: "met",
            lastRuleStatus: result.ruleStatus,
            lastEvidence: result.evidence ?? null,
            lastCheckedAt: result.checkedAt,
            metAt: result.checkedAt,
            lastError: null,
            lastBreakoutScore:
              typeof result.breakoutScore === "number"
                ? result.breakoutScore
                : (watch.lastBreakoutScore ?? null),
            lastDetectedTrend: detectedTrend ?? watch.trend,
          };
          setWatches((prev) => prev.map((w) => (w.id === id ? metWatch : w)));
          setBanner(
            `${result.symbol} · ${watch.ruleLabel} (${sideLabel}) met — polling stopped.`,
          );
          setMetPopup(metWatch);
          playAlarmBell();
          try {
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification(`Alarm: ${watch.symbol}`, {
                body: `${watch.ruleLabel} · ${sideLabel} met`,
                tag: `ov-market-alarm-${watch.id}`,
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
                  status: "running",
                  lastRuleStatus: result.ruleStatus,
                  lastEvidence: result.evidence ?? null,
                  lastCheckedAt: result.checkedAt,
                  lastError: result.error ?? null,
                  lastBreakoutScore:
                    typeof result.breakoutScore === "number"
                      ? result.breakoutScore
                      : (w.lastBreakoutScore ?? null),
                  lastDetectedTrend: detectedTrend ?? w.lastDetectedTrend ?? null,
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
                  status: timersRef.current.has(id) ? "running" : "error",
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

  const startWatch = useCallback(
    (id: string) => {
      const watch = watchesRef.current.find((w) => w.id === id);
      if (!watch || watch.status === "met") return;

      clearTimer(id);
      setFormError(null);
      setWatches((prev) =>
        prev.map((w) =>
          w.id === id ? { ...w, status: "running", lastError: null } : w,
        ),
      );

      const unit = watch.frequencyUnit === "hour" || watch.frequencyUnit === "sec"
        ? watch.frequencyUnit
        : "min";
      const ms = pollIntervalToMs(
        clampPollInterval(watch.frequencyValue, unit),
        unit,
      );
      void runCheck(id);
      const timer = window.setInterval(() => void runCheck(id), ms);
      timersRef.current.set(id, timer);
    },
    [clearTimer, runCheck],
  );

  const stopWatch = useCallback(
    (id: string) => {
      clearTimer(id);
      setWatches((prev) =>
        prev.map((w) =>
          w.id === id && w.status !== "met" ? { ...w, status: "stopped" } : w,
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
      if (watch && (watch.status === "running" || watch.status === "checking")) {
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
  const clearMetPopup = useCallback(() => setMetPopup(null), []);

  const addWatch = useCallback(
    (input: {
      symbols: string[];
      ruleKey: AlarmEligibleRuleKey;
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
      if (!ALARM_ELIGIBLE_RULES.some((r) => r.ruleKey === input.ruleKey)) {
        setFormError("Pick an eligible rule.");
        return false;
      }
      const trend: AlarmTrend =
        input.ruleKey === "breakout_quality"
          ? "auto"
          : input.trend === "bajista"
            ? "bajista"
            : "alcista";
      if (input.ruleKey !== "breakout_quality" && input.trend !== "alcista" && input.trend !== "bajista") {
        setFormError("Pick a trend (alcista or bajista).");
        return false;
      }
      const frequencyUnit =
        input.frequencyUnit === "hour" || input.frequencyUnit === "sec"
          ? input.frequencyUnit
          : "min";
      const frequencyValue = clampPollInterval(input.frequencyValue, frequencyUnit);

      const existing = watchesRef.current;
      const toAdd: MarketAlarmWatch[] = [];
      const skipped: string[] = [];
      for (const symbol of symbols) {
        const bandTf = input.ruleKey === "touch_disipador" ? input.bandTimeframe ?? "1m" : undefined;
        const dup = existing.some(
          (w) =>
            w.symbol === symbol &&
            w.ruleKey === input.ruleKey &&
            w.trend === trend &&
            (w.bandTimeframe ?? undefined) === bandTf &&
            w.status !== "met",
        );
        if (dup || toAdd.some((w) => w.symbol === symbol)) {
          skipped.push(symbol);
          continue;
        }
        toAdd.push({
          id: `alarm-${Date.now()}-${symbol}-${Math.random().toString(36).slice(2, 7)}`,
          symbol,
          ruleKey: input.ruleKey,
          ruleLabel: alarmRuleLabel(input.ruleKey),
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
        });
      }

      if (toAdd.length === 0) {
        setFormError(
          skipped.length
            ? "Those ticker + rule + trend watches already exist."
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
      .filter((w) => w.status === "running" || w.status === "checking")
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

  const metCount = watches.filter((w) => w.status === "met").length;
  const runningCount = watches.filter(
    (w) => w.status === "running" || w.status === "checking",
  ).length;

  return {
    watches,
    tickers,
    tickersLoading,
    tickersError,
    formError,
    banner,
    metPopup,
    clearMetBanner,
    clearMetPopup,
    eligibleRules: ALARM_ELIGIBLE_RULES,
    metCount,
    runningCount,
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
