import { alarmRulesLabel, type MarketAlarmWatch } from "./alarm-types";
import {
  DEFAULT_ORB_AUTO_SYMBOLS,
  ORB_BREAKOUT_RULE_KEY,
  isOrbAutoWatch,
} from "./orb-window";

export function buildOrbAutoWatch(
  symbol: string,
  pollIntervalSeconds = 45,
): MarketAlarmWatch {
  const sym = symbol.trim().toUpperCase();
  const ruleKeys = [ORB_BREAKOUT_RULE_KEY] as const;
  return {
    id: `orb-auto-${sym}-${Date.now()}`,
    symbol: sym,
    ruleKey: ORB_BREAKOUT_RULE_KEY,
    ruleKeys: [...ruleKeys],
    ruleLabel: alarmRulesLabel([...ruleKeys]),
    trend: "auto",
    alarmTarget: "entry_ready",
    orbAuto: true,
    frequencyValue: pollIntervalSeconds,
    frequencyUnit: "sec",
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
}

export function orbAutoSymbolsToEnsure(
  symbols: string[] | undefined,
): string[] {
  const raw = symbols?.length ? symbols : [...DEFAULT_ORB_AUTO_SYMBOLS];
  const out: string[] = [];
  for (const item of raw) {
    const sym = String(item || "")
      .trim()
      .toUpperCase();
    if (sym && !out.includes(sym)) out.push(sym);
  }
  return out.length > 0 ? out : [...DEFAULT_ORB_AUTO_SYMBOLS];
}

export function diffOrbAutoWatches(
  existing: MarketAlarmWatch[],
  symbols: string[],
  pollIntervalSeconds: number,
): { toAdd: MarketAlarmWatch[]; toRemoveIds: string[] } {
  const autoRows = existing.filter(isOrbAutoWatch);
  const want = new Set(symbols.map((s) => s.toUpperCase()));
  const have = new Set(autoRows.map((w) => w.symbol));
  const toAdd = symbols
    .filter((s) => !have.has(s.toUpperCase()))
    .map((s) => buildOrbAutoWatch(s, pollIntervalSeconds));
  const toRemoveIds = autoRows
    .filter((w) => !want.has(w.symbol))
    .map((w) => w.id);
  return { toAdd, toRemoveIds };
}
