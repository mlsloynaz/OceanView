import { describe, expect, it } from "vitest";
import {
  breakoutKanbanColumn,
  resolveChartWatch,
  watchHasBreakout,
} from "./BreakoutKanbanBoard";
import type { MarketAlarmWatch } from "./alarm-types";

describe("breakoutKanbanColumn", () => {
  const base: MarketAlarmWatch = {
    id: "1",
    symbol: "NFLX",
    ruleKey: "breakout_quality",
    ruleKeys: ["breakout_quality"],
    ruleLabel: "Breakout quality",
    trend: "auto",
    frequencyValue: 30,
    frequencyUnit: "sec",
    status: "running",
    lastRuleStatus: null,
    lastEvidence: null,
    lastCheckedAt: null,
    lastError: null,
    metAt: null,
  };

  it("maps lifecycle to columns", () => {
    expect(breakoutKanbanColumn({ ...base, lastLifecycle: "setup_forming" })).toBe("setup");
    expect(breakoutKanbanColumn({ ...base, lastLifecycle: "testing_level" })).toBe("setup");
    expect(breakoutKanbanColumn({ ...base, lastLifecycle: "awaiting_entry" })).toBe("confirmed");
    expect(breakoutKanbanColumn({ ...base, lastLifecycle: "confirmed" })).toBe("confirmed");
    expect(breakoutKanbanColumn({ ...base, lastLifecycle: "entry_ready" })).toBe("entry");
  });

  it("puts enter/exit/in_trade in Entry", () => {
    expect(breakoutKanbanColumn({ ...base, status: "met" })).toBe("entry");
    expect(breakoutKanbanColumn({ ...base, status: "in_trade" })).toBe("entry");
    expect(breakoutKanbanColumn({ ...base, status: "exit" })).toBe("entry");
  });

  it("detects breakout watches", () => {
    expect(watchHasBreakout(base)).toBe(true);
    expect(
      watchHasBreakout({
        ...base,
        ruleKey: "confirmation_change_trend_1h",
        ruleKeys: ["confirmation_change_trend_1h"],
      }),
    ).toBe(false);
  });
});

describe("resolveChartWatch", () => {
  const spark = {
    symbol: "AAPL",
    timeframe: "15m" as const,
    bbPeriod: 20,
    bars: [
      {
        datetime: "2026-07-24T10:00:00-04:00",
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        bbUpper: 2,
        bbMid: 1,
        bbLower: 0.5,
      },
    ],
  };

  const a: MarketAlarmWatch = {
    id: "a",
    symbol: "AAPL",
    ruleKey: "breakout_quality",
    ruleKeys: ["breakout_quality"],
    ruleLabel: "Breakout quality",
    trend: "auto",
    frequencyValue: 30,
    frequencyUnit: "sec",
    status: "running",
    lastRuleStatus: null,
    lastEvidence: null,
    lastCheckedAt: null,
    lastError: null,
    metAt: null,
    lastBreakoutScore: 40,
    lastBbSparkline15m: spark,
  };
  const b: MarketAlarmWatch = {
    ...a,
    id: "b",
    symbol: "NFLX",
    lastBreakoutScore: 80,
    lastBbSparkline15m: { ...spark, symbol: "NFLX" },
  };

  it("uses selected watch when present", () => {
    expect(resolveChartWatch([a, b], "a")?.id).toBe("a");
  });

  it("defaults to highest score with sparkline", () => {
    expect(resolveChartWatch([a, b], null)?.id).toBe("b");
  });
});
