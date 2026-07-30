import { useCallback, useEffect, useRef, useState } from "react";
import { getActiveTickersForAdmin } from "@/features/admin/tickers/api/tickers-client";
import type { CatalogTicker } from "@/features/admin/tickers/types";
import {
  PremarketAlarmApiError,
  postPremarketAlarmCheck,
} from "../api/alarm-client";
import type { DynamicStrategy } from "../api/dynamic-strategy-client";
import { activeDynamicStrategies } from "../lib/dynamic-strategies";
import {
  alarmIntervalMs,
  type AlarmFrequencyUnit,
  type PremarketAlarmWatch,
} from "../alarm-types";

const STORAGE_KEY = "oceanview.premarket.alarms";

type Args = {
  strategies: DynamicStrategy[];
  /** Shared Premarket quality threshold (met = quality ≥ this). */
  thresholdPct: number;
};

function loadStored(): PremarketAlarmWatch[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PremarketAlarmWatch[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row) => ({
      ...row,
      status: row.status === "running" || row.status === "checking" ? "stopped" : row.status,
    }));
  } catch {
    return [];
  }
}

function persist(watches: PremarketAlarmWatch[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(watches));
  } catch {
    /* ignore quota */
  }
}

function notifyMet(watch: PremarketAlarmWatch) {
  const title = `Alarm: ${watch.symbol}`;
  const body = `${watch.strategyName} met (≥ ${watch.thresholdPct}%)`;
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, tag: `ov-alarm-${watch.id}` });
    }
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(
      new CustomEvent("oceanview:premarket-alarm", {
        detail: { id: watch.id, symbol: watch.symbol, strategyName: watch.strategyName },
      }),
    );
  } catch {
    /* ignore */
  }
}

export function usePremarketAlarms({ strategies, thresholdPct }: Args) {
  const effectiveThreshold = thresholdPct > 0 ? thresholdPct : 50;
  const [watches, setWatches] = useState<PremarketAlarmWatch[]>(() => loadStored());
  const [tickers, setTickers] = useState<CatalogTicker[]>([]);
  const [tickersLoading, setTickersLoading] = useState(true);
  const [tickersError, setTickersError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const timersRef = useRef<Map<string, number>>(new Map());
  const inFlightRef = useRef<Set<string>>(new Set());
  const watchesRef = useRef(watches);
  watchesRef.current = watches;

  const activeStrategies = activeDynamicStrategies(strategies);

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
    for (const id of timersRef.current.keys()) {
      clearTimer(id);
    }
  }, [clearTimer]);

  useEffect(() => {
    return () => stopAllTimers();
  }, [stopAllTimers]);

  const runCheck = useCallback(
    async (id: string) => {
      if (inFlightRef.current.has(id)) return;
      const watch = watchesRef.current.find((w) => w.id === id);
      if (!watch || watch.status === "met") return;

      inFlightRef.current.add(id);
      setWatches((prev) =>
        prev.map((w) => (w.id === id ? { ...w, status: "checking", lastError: null } : w)),
      );

      try {
        const result = await postPremarketAlarmCheck({
          symbol: watch.symbol,
          strategyId: watch.strategyId,
          refreshCandles: true,
          signalThresholdPct: watch.thresholdPct,
        });

        if (result.met) {
          clearTimer(id);
          const metWatch: PremarketAlarmWatch = {
            ...watch,
            status: "met",
            lastQualityPct: result.qualityPct,
            lastCheckedAt: result.checkedAt,
            metAt: result.checkedAt,
            lastError: null,
            thresholdPct: result.signalThresholdPct,
          };
          setWatches((prev) => prev.map((w) => (w.id === id ? metWatch : w)));
          setBanner(
            `${result.symbol} · ${watch.strategyName} met at ${result.qualityPct}% — polling stopped.`,
          );
          notifyMet(metWatch);
          return;
        }

        setWatches((prev) =>
          prev.map((w) =>
            w.id === id
              ? {
                  ...w,
                  status: "running",
                  lastQualityPct: result.qualityPct,
                  lastCheckedAt: result.checkedAt,
                  lastError: result.error ?? null,
                }
              : w,
          ),
        );
      } catch (err) {
        const message =
          err instanceof PremarketAlarmApiError
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
    [clearTimer],
  );

  const startWatch = useCallback(
    (id: string) => {
      const watch = watchesRef.current.find((w) => w.id === id);
      if (!watch || watch.status === "met") return;

      clearTimer(id);
      setFormError(null);
      setWatches((prev) =>
        prev.map((w) =>
          w.id === id
            ? { ...w, status: "running", lastError: null, thresholdPct: effectiveThreshold }
            : w,
        ),
      );

      const ms = alarmIntervalMs(watch.frequencyValue, watch.frequencyUnit);
      void runCheck(id);
      const timer = window.setInterval(() => void runCheck(id), ms);
      timersRef.current.set(id, timer);
    },
    [clearTimer, runCheck, effectiveThreshold],
  );

  const stopWatch = useCallback(
    (id: string) => {
      clearTimer(id);
      setWatches((prev) =>
        prev.map((w) =>
          w.id === id && w.status !== "met"
            ? { ...w, status: "stopped" }
            : w,
        ),
      );
    },
    [clearTimer],
  );

  const removeWatch = useCallback(
    (id: string) => {
      clearTimer(id);
      setWatches((prev) => prev.filter((w) => w.id !== id));
    },
    [clearTimer],
  );

  const clearMetBanner = useCallback(() => setBanner(null), []);

  /** Reset a fired (met) watch so it can poll and alarm again. */
  const clearMetStatus = useCallback(
    (id: string, opts?: { restart?: boolean }) => {
      clearTimer(id);
      setWatches((prev) =>
        prev.map((w) =>
          w.id === id && w.status === "met"
            ? { ...w, status: "idle", metAt: null, lastError: null }
            : w,
        ),
      );
      setBanner(null);
      if (opts?.restart) {
        window.setTimeout(() => startWatch(id), 0);
      }
    },
    [clearTimer, startWatch],
  );

  const clearAllMetStatuses = useCallback(() => {
    const metIds = watchesRef.current.filter((w) => w.status === "met").map((w) => w.id);
    for (const id of metIds) clearTimer(id);
    setBanner(null);
    setWatches((prev) =>
      prev.map((w) =>
        w.status === "met" ? { ...w, status: "idle", metAt: null, lastError: null } : w,
      ),
    );
  }, [clearTimer]);

  const addWatch = useCallback(
    (input: {
      symbol: string;
      strategyId: string;
      frequencyValue: number;
      frequencyUnit: AlarmFrequencyUnit;
    }) => {
      const symbol = input.symbol.trim().toUpperCase();
      const strategy = activeStrategies.find((s) => s.id === input.strategyId);
      if (!symbol) {
        setFormError("Pick a ticker.");
        return false;
      }
      if (!strategy) {
        setFormError("Pick an active dynamic strategy.");
        return false;
      }
      const frequencyValue = Math.max(1, Math.floor(input.frequencyValue) || 1);
      const dup = watchesRef.current.some(
        (w) =>
          w.symbol === symbol &&
          w.strategyId === strategy.id &&
          w.status !== "met",
      );
      if (dup) {
        setFormError("That ticker + strategy watch already exists.");
        return false;
      }

      const watch: PremarketAlarmWatch = {
        id: `alarm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        symbol,
        strategyId: strategy.id,
        strategyName: strategy.name || strategy.id,
        frequencyValue,
        frequencyUnit: input.frequencyUnit,
        thresholdPct: effectiveThreshold,
        status: "idle",
        lastQualityPct: null,
        lastCheckedAt: null,
        lastError: null,
        metAt: null,
      };
      setFormError(null);
      setWatches((prev) => [watch, ...prev]);
      return true;
    },
    [activeStrategies, effectiveThreshold],
  );

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
    clearMetBanner,
    clearMetStatus,
    clearAllMetStatuses,
    activeStrategies,
    metCount,
    runningCount,
    addWatch,
    startWatch,
    stopWatch,
    removeWatch,
    runCheckNow: runCheck,
    requestNotifyPermission,
  };
}
