import { describe, expect, it } from "vitest";
import { chartForWatch } from "./MovementWatchGrid";
import type { MarketAlarmWatch } from "./alarm-types";

const fiveMinute: MarketAlarmWatch = {
  id: "1",
  symbol: "AAPL",
  ruleKey: "trend_change_5m",
  ruleKeys: ["trend_change_5m"],
  ruleLabel: "5m trend change",
  trend: "auto",
  frequencyValue: 60,
  frequencyUnit: "sec",
  status: "running",
  lastRuleStatus: null,
  lastEvidence: null,
  lastCheckedAt: null,
  lastError: null,
  metAt: null,
};

const bars = [
  {
    datetime: "2026-10-16T10:00:00-04:00",
    open: 1,
    high: 2,
    low: 0.5,
    close: 1.5,
    bbUpper: 2,
    bbMid: 1,
    bbLower: 0.5,
    ema10: 1.2,
    ema21: 1.1,
  },
];

describe("chartForWatch", () => {
  it("uses the 5m chart with both EMAs for 5m trend", () => {
    const chart = chartForWatch({
      ...fiveMinute,
      lastMovementChart: {
        symbol: "AAPL",
        timeframe: "5m",
        bbPeriod: 20,
        bars,
      },
      lastBbSparkline15m: {
        symbol: "AAPL",
        timeframe: "15m",
        bbPeriod: 20,
        bars,
      },
    });
    expect(chart?.timeframe).toBe("5m");
    expect(chart?.bars[0]?.ema10).toBe(1.2);
    expect(chart?.bars[0]?.ema21).toBe(1.1);
  });

  it("does not fall back to the 15m ORB sparkline", () => {
    const chart = chartForWatch({
      ...fiveMinute,
      lastBbSparkline15m: {
        symbol: "AAPL",
        timeframe: "15m",
        bbPeriod: 20,
        bars,
      },
    });
    expect(chart).toBeNull();
  });
});
