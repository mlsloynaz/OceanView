import { describe, expect, it } from "vitest";
import { angleLeaders, emaAngleDeg, fiveMinuteMove, handoffBars } from "./ActiveTickerBoard";
import type { BbSparkline15mBar } from "./alarm-types";

function bar(datetime: string): BbSparkline15mBar {
  return { datetime, open: 1, high: 1, low: 1, close: 1, bbUpper: null, bbMid: null, bbLower: null };
}

describe("five minute move", () => {
  it("reads the last two closes", () => {
    expect(fiveMinuteMove([10, 11])).toBe(1);
    expect(fiveMinuteMove([11, 10])).toBe(-1);
    expect(fiveMinuteMove([10])).toBeNull();
  });

  it("keeps the previous candles when the open arrives with fewer bars", () => {
    const previous = [bar("2026-08-27 15:55:00"), bar("2026-08-27 15:50:00")].reverse();
    const incoming = [bar("2026-08-28 09:30:00")];
    expect(handoffBars(previous, incoming).map((row) => row.datetime)).toEqual([
      "2026-08-27 15:50:00",
      "2026-08-27 15:55:00",
      "2026-08-28 09:30:00",
    ]);
    expect(handoffBars(previous, []).map((row) => row.datetime)).toEqual([
      "2026-08-27 15:50:00",
      "2026-08-27 15:55:00",
    ]);
  });
});

function emaBars(values: number[]): BbSparkline15mBar[] {
  return values.map((ema10, index) => ({
    datetime: `2026-11-06 10:${String(index).padStart(2, "0")}:00`,
    open: ema10,
    high: ema10,
    low: ema10,
    close: ema10,
    bbUpper: null,
    bbMid: null,
    bbLower: null,
    ema10,
  }));
}

describe("ema angle leaders", () => {
  it("uses the same 0.10% step as 45 degrees", () => {
    const angle = emaAngleDeg(100.1, 100);
    expect(angle).toBeCloseTo(45, 5);
  });

  it("names the steepest rise and the steepest drop on each timeframe", () => {
    const leaders = angleLeaders([
      { symbol: "NVDA", panes: { "1m": emaBars([100, 100.2]), "5m": emaBars([100, 99.8]), "15m": emaBars([50]) } },
      { symbol: "ORCL", panes: { "1m": emaBars([100, 99.7]), "5m": emaBars([100, 100.05]), "15m": [] } },
    ]);
    expect(leaders["1m"].up?.symbol).toBe("NVDA");
    expect(leaders["1m"].down?.symbol).toBe("ORCL");
    expect(leaders["5m"].up?.symbol).toBe("ORCL");
    expect(leaders["5m"].down?.symbol).toBe("NVDA");
    expect(leaders["15m"].up).toBeNull();
    expect(leaders["15m"].down).toBeNull();
  });
});
