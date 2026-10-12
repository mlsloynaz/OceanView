import { alarmRulesLabel, type MarketAlarmWatch } from "./alarm-types";
import {
  DEFAULT_ORB_AUTO_SYMBOLS,
  ORB5M_BREAKOUT_RULE_KEY,
  isOrb5mAutoWatch,
} from "./orb-window";

const STORAGE_KEY = "oceanview.market.orb5m.auto";

export type Orb5mAutoJobStatus = {
  jobType: "orb5m_auto_monitor";
  kind: "orb5m_auto_monitor";
  status: "idle" | "running" | "cancelled" | "completed";
  symbols: string[];
  tradeDate: string;
  message: string;
  windowOpen: boolean;
  pollIntervalSeconds: number;
};

export function buildOrb5mAutoWatch(
  symbol: string,
  pollIntervalSeconds = 30,
): MarketAlarmWatch {
  const sym = symbol.trim().toUpperCase();
  const ruleKeys = [ORB5M_BREAKOUT_RULE_KEY] as const;
  return {
    id: `orb5m-auto-${sym}-${Date.now()}`,
    symbol: sym,
    ruleKey: ORB5M_BREAKOUT_RULE_KEY,
    ruleKeys: [...ruleKeys],
    ruleLabel: alarmRulesLabel([...ruleKeys]),
    trend: "auto",
    alarmTarget: "entry_ready",
    orb5mAuto: true,
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

const LEGACY_ORB_AUTO_SYMBOLS = ["TSLA", "MSFT", "SPY"] as const;

export function favoriteOrbSymbols(
  tickers: readonly { symbol: string; isFavorite?: boolean; active?: boolean }[],
): string[] {
  const favActive: string[] = [];
  const favAll: string[] = [];
  for (const row of tickers) {
    if (!row.isFavorite) continue;
    const sym = String(row.symbol || "").trim().toUpperCase();
    if (!sym) continue;
    if (!favAll.includes(sym)) favAll.push(sym);
    if (row.active !== false && !favActive.includes(sym)) favActive.push(sym);
  }
  return favActive.length > 0 ? favActive : favAll;
}

export function isLegacyOrbAutoTrio(symbols: readonly string[]): boolean {
  const normalized = symbols.map((s) => s.trim().toUpperCase()).filter(Boolean);
  return (
    normalized.length === LEGACY_ORB_AUTO_SYMBOLS.length &&
    LEGACY_ORB_AUTO_SYMBOLS.every((sym) => normalized.includes(sym))
  );
}

/** Favorites win. The old TSLA / MSFT / SPY list is not a real watchlist. */
export function resolveOrb5mAutoSymbols(
  stored: readonly string[] | undefined,
  favorites: readonly string[],
): string[] {
  const fav = favorites.map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (fav.length > 0) return [...new Set(fav)];
  const kept = (stored ?? []).map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (kept.length === 0 || isLegacyOrbAutoTrio(kept)) return [];
  return [...new Set(kept)];
}

export function orb5mAutoSymbolsToEnsure(symbols: string[] | undefined): string[] {
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

export function diffOrb5mAutoWatches(
  existing: MarketAlarmWatch[],
  symbols: string[],
  pollIntervalSeconds: number,
  heldSymbols: Iterable<string> = [],
): { toAdd: MarketAlarmWatch[]; toRemoveIds: string[] } {
  const autoRows = existing.filter(isOrb5mAutoWatch);
  const want = new Set(symbols.map((s) => s.toUpperCase()));
  const held = new Set(
    [...heldSymbols].map((s) => s.trim().toUpperCase()).filter(Boolean),
  );
  const have = new Set(autoRows.map((w) => w.symbol));
  const toAdd = symbols
    .filter((s) => {
      const upper = s.toUpperCase();
      return !held.has(upper) && !have.has(upper);
    })
    .map((s) => buildOrb5mAutoWatch(s, pollIntervalSeconds));
  const toRemoveIds = autoRows
    .filter((w) => !want.has(w.symbol))
    .map((w) => w.id);
  return { toAdd, toRemoveIds };
}

export function parseOrbSymbolList(raw: string): string[] {
  return orb5mAutoSymbolsToEnsure(
    raw
      .toUpperCase()
      .split(/[\s,;]+/)
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

export function tradeDateEt(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function defaultJob(now: Date): Orb5mAutoJobStatus {
  return {
    jobType: "orb5m_auto_monitor",
    kind: "orb5m_auto_monitor",
    status: "idle",
    symbols: [],
    tradeDate: tradeDateEt(now),
    message: "5m ORB auto checks favorite tickers.",
    windowOpen: false,
    pollIntervalSeconds: 30,
  };
}

export function loadOrb5mAutoJob(now: Date = new Date()): Orb5mAutoJobStatus {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultJob(now);
    const parsed = JSON.parse(raw) as Partial<Orb5mAutoJobStatus>;
    const today = tradeDateEt(now);
    const tradeDate = String(parsed.tradeDate || today);
    let status = parsed.status ?? "idle";
    if (tradeDate !== today) status = "idle";
    return {
      ...defaultJob(now),
      ...parsed,
      status,
      tradeDate: tradeDate === today ? tradeDate : today,
      symbols: resolveOrb5mAutoSymbols(
        Array.isArray(parsed.symbols) ? parsed.symbols : [],
        [],
      ),
    };
  } catch {
    return defaultJob(now);
  }
}

export function saveOrb5mAutoJob(job: Orb5mAutoJobStatus): Orb5mAutoJobStatus {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(job));
  } catch {
    /* ignore */
  }
  return job;
}
