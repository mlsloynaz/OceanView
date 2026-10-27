import { describe, expect, it } from "vitest";
import { fitThumbnailGrid } from "./fit-thumbnail-grid";
import { detectedEntryAt, lastEntryTitle } from "./five-minute-entry";
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

describe("fitThumbnailGrid", () => {
  it("keeps a 16:10 thumbnail inside the pane for every chart", () => {
    const fit = fitThumbnailGrid(6, 1600, 900);
    const cellWidth = (1600 - 8 * (fit.columns - 1)) / fit.columns;
    const cellHeight = (900 - 8 * (fit.rows - 1)) / fit.rows;
    const thumbWidth = Math.min(cellWidth, cellHeight * (16 / 10));
    const thumbHeight = thumbWidth / (16 / 10);
    expect(fit.columns * fit.rows).toBeGreaterThanOrEqual(6);
    expect(thumbWidth / thumbHeight).toBeCloseTo(1.6, 5);
    expect(fit.rows * thumbHeight + (fit.rows - 1) * 8).toBeLessThanOrEqual(900);
    expect(fit.columns * thumbWidth + (fit.columns - 1) * 8).toBeLessThanOrEqual(1600);
  });
});

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

describe("detectedEntryAt", () => {
  it("keeps the entry time and ignores an exit stamp", () => {
    expect(
      detectedEntryAt({
        status: "exit",
        lastEntryAt: "2026-10-26T09:36:00-04:00",
        metAt: "2026-10-26T09:36:00-04:00",
      }),
    ).toBe("2026-10-26T09:36:00-04:00");
    expect(
      detectedEntryAt({
        status: "running",
        lastEntryAt: "2026-10-26T09:36:00-04:00",
        metAt: null,
      }),
    ).toBeNull();
  });

  it("titles the last entry as time, operation, and estimate", () => {
    expect(
      lastEntryTitle({
        status: "in_trade",
        lastEntryAt: "2026-10-26T10:36:00-04:00",
        metAt: null,
        lastDetectedTrend: "alcista",
        lastOptionGainPct: 42.09,
      }),
    ).toBe("10:36 : - CALL 42.09%");
    expect(
      lastEntryTitle({
        status: "exit",
        lastEntryAt: "2026-10-26T11:05:00-04:00",
        metAt: null,
        lastDetectedTrend: "bajista",
        lastOptionGainPct: 12,
      }),
    ).toBe("11:05 : - PUT 12.00%");
    expect(
      lastEntryTitle({
        status: "in_trade",
        lastEntryAt: "2026-10-26T14:46:00.000Z",
        metAt: null,
        lastDetectedTrend: "alcista",
        lastOptionGainPct: 54.93,
      }),
    ).toBe("10:46 : - CALL 54.93%");
  });
});
