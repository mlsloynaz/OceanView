import {
  alarmRulesLabel,
  watchRuleKeys,
  type AlarmEligibleRuleKey,
  type MarketAlarmWatch,
} from "./alarm-types";

export const MOVEMENT_WATCH_JOB_TYPE = "movement_watch" as const;

export type MovementWatchJobStatus = {
  jobType: typeof MOVEMENT_WATCH_JOB_TYPE | string;
  kind?: string;
  title?: string;
  status: "idle" | "running" | "cancelled" | "completed" | string;
  symbols: string[];
  ruleKeys: string[];
  tradeDate?: string | null;
  message?: string | null;
  jobActive?: boolean;
  canStart?: boolean;
  canStop?: boolean;
  pollIntervalSeconds?: number;
  activeTickerCount?: number;
};

export function isMovementWatchAutoWatch(
  watch: Pick<MarketAlarmWatch, "movementWatch" | "ruleKey" | "ruleKeys">,
): boolean {
  return Boolean(watch.movementWatch);
}

export function buildMovementWatchAutoWatch(
  symbol: string,
  ruleKey: AlarmEligibleRuleKey,
  pollIntervalSeconds = 60,
): MarketAlarmWatch {
  const sym = symbol.trim().toUpperCase();
  const ruleKeys = [ruleKey] as AlarmEligibleRuleKey[];
  return {
    id: `movement-watch-${sym}-${ruleKey}-${Date.now()}`,
    symbol: sym,
    ruleKey,
    ruleKeys: [...ruleKeys],
    ruleLabel: alarmRulesLabel([...ruleKeys]),
    trend: "auto",
    movementWatch: true,
    frequencyValue: pollIntervalSeconds,
    frequencyUnit: "sec",
    status: "idle",
    silenceInitialMet: true,
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
}

/** True when the Admin Movement Watch job already covers this ticker + movement. */
export function movementWatchJobCovers(
  job: Pick<MovementWatchJobStatus, "status" | "symbols" | "ruleKeys"> | null | undefined,
  symbol: string,
  ruleKey: string,
): boolean {
  if (!job || String(job.status || "").toLowerCase() !== "running") return false;
  const sym = symbol.trim().toUpperCase();
  const key = String(ruleKey || "").trim();
  if (!sym || !key) return false;
  const symbols = (job.symbols ?? []).map((s) => String(s || "").trim().toUpperCase());
  const rules = (job.ruleKeys ?? []).map((k) => String(k || "").trim());
  return symbols.includes(sym) && rules.includes(key);
}

/** Auto Movement Watch row already polling this ticker + movement. */
export function movementWatchAutoCovers(
  existing: readonly MarketAlarmWatch[],
  symbol: string,
  ruleKey: string,
): boolean {
  const sym = symbol.trim().toUpperCase();
  const key = String(ruleKey || "").trim();
  if (!sym || !key) return false;
  return existing.some((watch) => {
    if (!isMovementWatchAutoWatch(watch)) return false;
    if (watch.symbol !== sym) return false;
    return watchRuleKeys(watch).includes(key as AlarmEligibleRuleKey);
  });
}

/**
 * Manual (or other) watch for this exact ticker + single movement.
 * Used to update interval / restart instead of adding a duplicate.
 */
export function findManualMovementComboWatch(
  existing: readonly MarketAlarmWatch[],
  symbol: string,
  ruleKey: string,
): MarketAlarmWatch | undefined {
  const sym = symbol.trim().toUpperCase();
  const key = String(ruleKey || "").trim();
  if (!sym || !key) return undefined;
  return existing.find((watch) => {
    if (isMovementWatchAutoWatch(watch)) return false;
    if (watch.symbol !== sym) return false;
    const keys = watchRuleKeys(watch);
    return keys.length === 1 && keys[0] === key;
  });
}

/** One watch per (symbol, ruleKey) so each movement rings independently. */
export function diffMovementWatchAutoWatches(
  existing: MarketAlarmWatch[],
  symbols: string[],
  ruleKeys: string[],
  pollIntervalSeconds: number,
): { toAdd: MarketAlarmWatch[]; toRemoveIds: string[] } {
  const autoRows = existing.filter(isMovementWatchAutoWatch);
  const want = new Set<string>();
  for (const sym of symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)) {
    for (const key of ruleKeys.map((k) => k.trim()).filter(Boolean)) {
      want.add(`${sym}::${key}`);
    }
  }
  const have = new Map<string, string>();
  for (const watch of autoRows) {
    const keys =
      watch.ruleKeys?.length > 0 ? watch.ruleKeys : [watch.ruleKey];
    for (const key of keys) {
      have.set(`${watch.symbol}::${key}`, watch.id);
    }
  }
  const toAdd: MarketAlarmWatch[] = [];
  for (const pair of want) {
    if (have.has(pair)) continue;
    const [sym, key] = pair.split("::");
    if (!sym || !key) continue;
    toAdd.push(
      buildMovementWatchAutoWatch(
        sym,
        key as AlarmEligibleRuleKey,
        pollIntervalSeconds,
      ),
    );
  }
  const toRemoveIds = autoRows
    .filter((watch) => {
      const keys =
        watch.ruleKeys?.length > 0 ? watch.ruleKeys : [watch.ruleKey];
      return !keys.some((key) => want.has(`${watch.symbol}::${key}`));
    })
    .map((w) => w.id);
  return { toAdd, toRemoveIds };
}
