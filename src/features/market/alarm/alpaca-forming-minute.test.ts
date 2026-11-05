import { describe, expect, it } from "vitest";
import { barFromAlpacaMinute, mergeFormingMinute, nextFormingDelayMs } from "./alpaca-forming-minute";
import type { BbSparkline15mBar } from "./alarm-types";

function bar(datetime: string, close = 10): BbSparkline15mBar {
  return {
    datetime,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    bbUpper: null,
    bbMid: null,
    bbLower: null,
  };
}

describe("forming minute cadence", () => {
  it("polls every 10s until 11:00 ET and every 30s after, only in the regular session", () => {
    expect(nextFormingDelayMs(new Date("2026-11-03T14:29:00Z"))).toBeNull();
    expect(nextFormingDelayMs(new Date("2026-11-03T14:30:00Z"))).toBe(10_000);
    expect(nextFormingDelayMs(new Date("2026-11-03T15:59:00Z"))).toBe(10_000);
    expect(nextFormingDelayMs(new Date("2026-11-03T16:00:00Z"))).toBe(30_000);
    expect(nextFormingDelayMs(new Date("2026-11-03T20:59:00Z"))).toBe(30_000);
    expect(nextFormingDelayMs(new Date("2026-11-03T21:00:00Z"))).toBeNull();
    expect(nextFormingDelayMs(new Date("2026-11-07T15:00:00Z"))).toBeNull();
  });
});

describe("repaint with the completed Schwab minute", () => {
  const schwab = [bar("2026-11-03 10:00:00"), bar("2026-11-03 10:01:00", 11)];

  it("keeps the Alpaca candle while that minute is still open", () => {
    const forming = { ...bar("2026-11-03 10:02:00", 12), forming: true };
    const merged = mergeFormingMinute(schwab, forming, new Date("2026-11-03T15:02:20Z"));
    expect(merged.map((item) => item.datetime)).toEqual([
      "2026-11-03 10:00:00",
      "2026-11-03 10:01:00",
      "2026-11-03 10:02:00",
    ]);
    expect(merged[2]?.forming).toBe(true);
    expect(merged[2]?.close).toBe(12);
  });

  it("holds the Alpaca print after the minute closes until Schwab has that candle", () => {
    const forming = bar("2026-11-03 10:02:00", 12);
    const merged = mergeFormingMinute(schwab, forming, new Date("2026-11-03T15:03:05Z"));
    expect(merged[2]?.datetime).toBe("2026-11-03 10:02:00");
    expect(merged[2]?.forming).toBe(false);
  });

  it("replaces the Alpaca candle when Schwab has the completed minute", () => {
    const completed = [...schwab, { ...bar("2026-11-03 10:02:00", 13), ema10: 11 }];
    const alpaca = bar("2026-11-03 10:02:00", 12);
    const merged = mergeFormingMinute(completed, alpaca, new Date("2026-11-03T15:03:05Z"));
    expect(merged).toHaveLength(3);
    expect(merged[2]?.close).toBe(13);
    expect(merged[2]?.forming).toBe(false);
    expect(merged[2]?.ema10).toBe(11);
  });
});

describe("Alpaca minute bar", () => {
  it("maps the snapshot minute into an ET candle", () => {
    const bar = barFromAlpacaMinute({ t: "2026-11-03T15:02:00Z", o: 1, h: 3, l: 0.5, c: 2, v: 10 });
    expect(bar?.datetime).toBe("2026-11-03 10:02:00");
    expect(bar?.close).toBe(2);
    expect(bar?.forming).toBe(true);
  });
});
