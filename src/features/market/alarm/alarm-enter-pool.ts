/**
 * In-memory ENTER alarm pool: newest alarm first, then higher possible earning.
 * EXIT stays outside this pool.
 */
import type { MarketAlarmWatch } from "./alarm-types";

/** Wait this long after the first enqueue so a poll batch can join the same bucket. */
export const ENTER_POOL_FLUSH_MS = 400;

export type AlarmPoolEntry = {
  watchId: string;
  symbol: string;
  kind: "enter";
  earningPct: number | null;
  side: string;
  ruleLabel: string;
  evidence?: string | null;
  enqueuedAt: number;
  /** Snapshot used to open the modal / desktop notify. */
  watch: MarketAlarmWatch;
  sideLabel: string;
  simSuffix: string;
};

export type RankedEnter = AlarmPoolEntry & {
  isTop: boolean;
  topRatedSymbol?: string;
  topRatedEarningPct?: number | null;
};

export function resolveEarningPct(
  optionGainPct: number | null | undefined,
  evidence: string | null | undefined,
): number | null {
  if (typeof optionGainPct === "number" && Number.isFinite(optionGainPct)) {
    return optionGainPct;
  }
  const match = evidence?.match(/est\. earning\s+([0-9]+(?:\.[0-9]+)?)%/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function formatTopRatedLine(
  symbol: string,
  earningPct: number | null | undefined,
): string {
  const sym = symbol.trim().toUpperCase();
  if (typeof earningPct === "number" && Number.isFinite(earningPct)) {
    return `TOP: ${sym} · ${Math.round(earningPct)}%`;
  }
  return `TOP: ${sym}`;
}

function earningRank(value: number | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

/** When the alarm rang. Prefer the stored signal time over when it was queued. */
export function enterTriggeredAtMs(entry: Pick<AlarmPoolEntry, "watch" | "enqueuedAt">): number {
  const raw = entry.watch.lastAlarmAt || entry.watch.metAt;
  const parsed = raw ? Date.parse(raw) : Number.NaN;
  if (Number.isFinite(parsed)) return parsed;
  return entry.enqueuedAt;
}

/** Clock minute, so 10:15:02 and 10:15:40 are the same time. */
function triggerMinute(entry: AlarmPoolEntry): number {
  return Math.floor(enterTriggeredAtMs(entry) / 60_000);
}

/** Newest minute first. Inside that minute, higher possible earning, then symbol. */
export function rankEnterPool(entries: AlarmPoolEntry[]): RankedEnter[] {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => {
    const byTime = triggerMinute(b) - triggerMinute(a);
    if (byTime !== 0) return byTime;
    const byEarn = earningRank(b.earningPct) - earningRank(a.earningPct);
    if (byEarn !== 0) return byEarn;
    return a.symbol.localeCompare(b.symbol);
  });
  const top = sorted[0]!;
  return sorted.map((entry, index) => {
    if (index === 0) {
      return { ...entry, isTop: true };
    }
    return {
      ...entry,
      isTop: false,
      topRatedSymbol: top.symbol,
      topRatedEarningPct: top.earningPct,
    };
  });
}

/**
 * Merge visible ENTER alerts with a new flush (incoming replaces same watchId),
 * then re-rank so the UI can highlight the current top.
 */
export function mergeAndRankEnterPool(
  existing: AlarmPoolEntry[],
  incoming: AlarmPoolEntry[],
): RankedEnter[] {
  const byId = new Map<string, AlarmPoolEntry>();
  for (const row of existing) byId.set(row.watchId, row);
  for (const row of incoming) byId.set(row.watchId, row);
  return rankEnterPool([...byId.values()]);
}

export function formatEarningPctLabel(earningPct: number | null | undefined): string {
  if (typeof earningPct === "number" && Number.isFinite(earningPct)) {
    return `${Math.round(earningPct)}%`;
  }
  return "—";
}

export type EnterAlarmPool = {
  enqueue: (entry: AlarmPoolEntry) => void;
  /** Rank + clear when the flush window elapsed, or when `force`. */
  flushDue: (now: number, opts?: { force?: boolean }) => RankedEnter[] | null;
  clear: () => void;
  size: () => number;
  hasPending: () => boolean;
};

export function createEnterAlarmPool(opts?: {
  flushDelayMs?: number;
}): EnterAlarmPool {
  const flushDelayMs = opts?.flushDelayMs ?? ENTER_POOL_FLUSH_MS;
  let bucket: AlarmPoolEntry[] = [];
  let flushAt: number | null = null;

  return {
    enqueue(entry) {
      const idx = bucket.findIndex((row) => row.watchId === entry.watchId);
      if (idx >= 0) {
        bucket[idx] = entry;
      } else {
        bucket.push(entry);
      }
      if (flushAt == null) {
        flushAt = entry.enqueuedAt + flushDelayMs;
      }
    },

    flushDue(now, options) {
      if (bucket.length === 0) return null;
      const force = options?.force === true;
      if (!force && flushAt != null && now < flushAt) return null;
      const ranked = rankEnterPool(bucket);
      bucket = [];
      flushAt = null;
      return ranked;
    },

    clear() {
      bucket = [];
      flushAt = null;
    },

    size() {
      return bucket.length;
    },

    hasPending() {
      return bucket.length > 0;
    },
  };
}
