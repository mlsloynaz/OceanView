import { describe, expect, it } from "vitest";
import {
  createEnterAlarmPool,
  formatTopRatedLine,
  mergeAndRankEnterPool,
  rankEnterPool,
  resolveEarningPct,
  type AlarmPoolEntry,
} from "./alarm-enter-pool";
import type { MarketAlarmWatch } from "./alarm-types";

function stubWatch(partial: Partial<MarketAlarmWatch> & Pick<MarketAlarmWatch, "id" | "symbol">): MarketAlarmWatch {
  return {
    ruleKey: "trend_change_5m",
    ruleKeys: ["trend_change_5m"],
    ruleLabel: "5m trend change",
    trend: "auto",
    frequencyValue: 1,
    frequencyUnit: "m",
    status: "met",
    lastRuleStatus: "met",
    lastEvidence: null,
    lastCheckedAt: null,
    lastError: null,
    metAt: new Date().toISOString(),
    ...partial,
  };
}

function entry(
  overrides: Partial<AlarmPoolEntry> & Pick<AlarmPoolEntry, "watchId" | "symbol" | "earningPct">,
  triggeredAt = "2026-10-16T14:15:00.000Z",
): AlarmPoolEntry {
  const watch = stubWatch({
    id: overrides.watchId,
    symbol: overrides.symbol,
    metAt: triggeredAt,
    lastAlarmAt: triggeredAt,
  });
  return {
    kind: "enter",
    side: "alcista",
    ruleLabel: "5m trend change",
    enqueuedAt: 1_000,
    watch,
    sideLabel: "alcista",
    simSuffix: "",
    ...overrides,
  };
}

describe("resolveEarningPct", () => {
  it("prefers numeric possibleOptionGainPct", () => {
    expect(resolveEarningPct(41.2, "est. earning 12%")).toBe(41.2);
  });

  it("parses est. earning from evidence", () => {
    expect(resolveEarningPct(null, "Valid · est. earning 28.5% · bias CALL")).toBe(28.5);
  });
});

describe("rankEnterPool", () => {
  it("puts the newer alarm above a higher earning from an earlier minute", () => {
    const ranked = rankEnterPool([
      entry({ watchId: "a", symbol: "AAPL", earningPct: 40 }, "2026-10-16T14:10:00.000Z"),
      entry({ watchId: "b", symbol: "MSFT", earningPct: 12 }, "2026-10-16T14:15:00.000Z"),
    ]);
    expect(ranked[0]?.symbol).toBe("MSFT");
    expect(ranked[1]?.symbol).toBe("AAPL");
  });

  it("inside the same minute, higher earning is on top", () => {
    const ranked = rankEnterPool([
      entry({ watchId: "a", symbol: "AAPL", earningPct: 12 }, "2026-10-16T14:15:40.000Z"),
      entry({ watchId: "b", symbol: "MSFT", earningPct: 41 }, "2026-10-16T14:15:05.000Z"),
    ]);
    expect(ranked[0]?.symbol).toBe("MSFT");
    expect(ranked[1]?.symbol).toBe("AAPL");
  });

  it("ranks higher earning as top; other payload points at it", () => {
    const ranked = rankEnterPool([
      entry({ watchId: "a", symbol: "AAPL", earningPct: 22 }),
      entry({ watchId: "b", symbol: "MSFT", earningPct: 41 }),
    ]);
    expect(ranked).toHaveLength(2);
    expect(ranked[0]).toMatchObject({
      symbol: "MSFT",
      isTop: true,
    });
    expect(ranked[0]?.topRatedSymbol).toBeUndefined();
    expect(ranked[1]).toMatchObject({
      symbol: "AAPL",
      isTop: false,
      topRatedSymbol: "MSFT",
      topRatedEarningPct: 41,
    });
  });

  it("tie-breaks by symbol when earning matches", () => {
    const ranked = rankEnterPool([
      entry({ watchId: "z", symbol: "TSLA", earningPct: 30 }),
      entry({ watchId: "a", symbol: "AAPL", earningPct: 30 }),
    ]);
    expect(ranked[0]?.symbol).toBe("AAPL");
    expect(ranked[0]?.isTop).toBe(true);
    expect(ranked[1]?.topRatedSymbol).toBe("AAPL");
  });

  it("does not self-ref when only one candidate", () => {
    const ranked = rankEnterPool([entry({ watchId: "1", symbol: "NVDA", earningPct: 50 })]);
    expect(ranked[0]).toMatchObject({ isTop: true, symbol: "NVDA" });
    expect(ranked[0]?.topRatedSymbol).toBeUndefined();
  });
});

describe("createEnterAlarmPool", () => {
  it("flushes after the debounce window with ranked top ref", () => {
    const pool = createEnterAlarmPool({ flushDelayMs: 400 });
    pool.enqueue(entry({ watchId: "a", symbol: "AAPL", earningPct: 10, enqueuedAt: 0 }));
    pool.enqueue(entry({ watchId: "b", symbol: "MSFT", earningPct: 41, enqueuedAt: 100 }));
    expect(pool.flushDue(200)).toBeNull();
    const flushed = pool.flushDue(400);
    expect(flushed?.[0]?.symbol).toBe("MSFT");
    expect(flushed?.[1]).toMatchObject({
      symbol: "AAPL",
      topRatedSymbol: "MSFT",
      topRatedEarningPct: 41,
    });
    expect(pool.hasPending()).toBe(false);
  });

  it("force flush returns ranked bucket immediately", () => {
    const pool = createEnterAlarmPool({ flushDelayMs: 5000 });
    pool.enqueue(entry({ watchId: "a", symbol: "AMD", earningPct: 5, enqueuedAt: 0 }));
    const flushed = pool.flushDue(100, { force: true });
    expect(flushed).toHaveLength(1);
    expect(flushed?.[0]?.isTop).toBe(true);
  });
});

describe("mergeAndRankEnterPool", () => {
  it("merges a visible ENTER with a new pool hit and re-ranks top", () => {
    const visible = [entry({ watchId: "a", symbol: "AAPL", earningPct: 22 })];
    const incoming = [entry({ watchId: "b", symbol: "MSFT", earningPct: 41 })];
    const merged = mergeAndRankEnterPool(visible, incoming);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ symbol: "MSFT", isTop: true });
    expect(merged[1]).toMatchObject({
      symbol: "AAPL",
      isTop: false,
      topRatedSymbol: "MSFT",
      topRatedEarningPct: 41,
    });
  });

  it("replaces an existing watchId with the fresher earning", () => {
    const visible = [entry({ watchId: "a", symbol: "AAPL", earningPct: 10 })];
    const incoming = [entry({ watchId: "a", symbol: "AAPL", earningPct: 55 })];
    const merged = mergeAndRankEnterPool(visible, incoming);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.earningPct).toBe(55);
    expect(merged[0]?.isTop).toBe(true);
  });
});

describe("formatTopRatedLine", () => {
  it("formats TOP line with rounded pct", () => {
    expect(formatTopRatedLine("msft", 41.4)).toBe("TOP: MSFT · 41%");
  });
});
