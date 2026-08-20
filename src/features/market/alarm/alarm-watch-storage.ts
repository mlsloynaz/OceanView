/**
 * Shared Market Alarm watch storage — SemiFinal can enqueue confirm watches
 * without owning the Alarm UI.
 */
import {
  alarmRulesLabel,
  alarmWatchConflicts,
  type AlarmEligibleRuleKey,
  type MarketAlarmWatch,
} from "@/features/market/alarm/alarm-types";
import {
  E03_CONFIRM_RULE_KEY,
  isE03ConfirmExpired,
} from "@/features/market/alarm/e03-confirm-window";
import { isSessionMonitorEnded } from "@/features/market/alarm/session-monitor-end";
import { clampPollInterval, type PollIntervalUnit } from "@/shared/components/PollControls";

export const MARKET_ALARM_STORAGE_KEY = "oceanview.market.alarms";
export const MARKET_ALARM_CHANGED_EVENT = "oceanview.market.alarms.changed";
/** detail: { watchId: string } — Market Alarm starts poll when mounted. */
export const MARKET_ALARM_START_REQUEST_EVENT = "oceanview.market.alarms.start-request";

function migrateRuleKey(key: string): AlarmEligibleRuleKey {
  if (key === "candle_confirm_1h") return "confirmation_change_trend_1h";
  if (key === "candle_confirm_15m") return "confirmation_change_trend_15m";
  return key as AlarmEligibleRuleKey;
}

export function loadMarketAlarmWatches(): MarketAlarmWatch[] {
  try {
    const raw = sessionStorage.getItem(MARKET_ALARM_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MarketAlarmWatch[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row) => {
      const ruleKeys = (row.ruleKeys?.length ? row.ruleKeys : [row.ruleKey]).map(migrateRuleKey);
      return {
        ...row,
        ruleKey: ruleKeys[0]!,
        ruleKeys,
        ruleLabel: row.ruleLabel?.trim() || alarmRulesLabel(ruleKeys),
        trend: "auto" as const,
      };
    });
  } catch {
    return [];
  }
}

export function persistMarketAlarmWatches(watches: MarketAlarmWatch[]): void {
  try {
    sessionStorage.setItem(MARKET_ALARM_STORAGE_KEY, JSON.stringify(watches));
    window.dispatchEvent(new CustomEvent(MARKET_ALARM_CHANGED_EVENT));
  } catch {
    /* ignore quota */
  }
}

export type EnqueueConfirmWatchInput = {
  symbol: string;
  confirmRuleKey: AlarmEligibleRuleKey;
  frequencyValue: number;
  frequencyUnit: PollIntervalUnit;
  /** Hint for rule label (e.g. Confirmación E01). */
  confirmLabel?: string;
  /** Ask Market Alarm (if mounted) to start polling immediately. Prefer idle + Start on Alarms. */
  startNow?: boolean;
};

/**
 * Add a confirm-only watch (idle). Optionally request Market Alarm to Start.
 */
export function enqueueConfirmWatch(
  input: EnqueueConfirmWatchInput,
): { ok: true; watch: MarketAlarmWatch } | { ok: false; reason: "duplicate" | "invalid" | "window_closed" | "session_ended" } {
  const symbol = input.symbol.trim().toUpperCase();
  const ruleKey = input.confirmRuleKey;
  if (!symbol || !ruleKey) return { ok: false, reason: "invalid" };
  if (isSessionMonitorEnded()) {
    return { ok: false, reason: "session_ended" };
  }
  if (ruleKey === E03_CONFIRM_RULE_KEY && isE03ConfirmExpired()) {
    return { ok: false, reason: "window_closed" };
  }

  const existing = loadMarketAlarmWatches();
  if (alarmWatchConflicts(existing, { symbol, ruleKeys: [ruleKey] })) {
    return { ok: false, reason: "duplicate" };
  }

  const frequencyUnit =
    input.frequencyUnit === "hour" || input.frequencyUnit === "sec" ? input.frequencyUnit : "min";
  const frequencyValue = clampPollInterval(input.frequencyValue, frequencyUnit);
  const ruleKeys: AlarmEligibleRuleKey[] = [ruleKey];
  const watch: MarketAlarmWatch = {
    id: `alarm-${Date.now()}-${symbol}-${Math.random().toString(36).slice(2, 7)}`,
    symbol,
    ruleKey,
    ruleKeys,
    ruleLabel: input.confirmLabel?.trim() || alarmRulesLabel(ruleKeys),
    trend: "auto",
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
  };

  persistMarketAlarmWatches([watch, ...existing]);
  if (input.startNow) {
    window.dispatchEvent(
      new CustomEvent(MARKET_ALARM_START_REQUEST_EVENT, {
        detail: { watchId: watch.id },
      }),
    );
  }
  return { ok: true, watch };
}
