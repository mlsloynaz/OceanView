import { describe, expect, it } from "vitest";
import { angleLeaders, angleMarksFor, fiveMinuteMove, handoffBars, latestEmaAngle, leaderOnEveryFrame } from "./ActiveTickerBoard";
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

function rangedBars(emas: number[], low: number, high: number): BbSparkline15mBar[] {
  return emas.map((ema10, index) => ({
    datetime: `2026-11-06 10:${String(index).padStart(2, "0")}:00`,
    open: ema10,
    high,
    low,
    close: ema10,
    bbUpper: null,
    bbMid: null,
    bbLower: null,
    ema10,
  }));
}

describe("ema angle leaders", () => {
  it("ranks the line that falls farther across its own reset chart", () => {
    const aapl = rangedBars([228, 221], 220, 230);
    const tsla = rangedBars([450, 430], 400, 480);
    expect(latestEmaAngle(aapl, 15 / 8)).toBeLessThan(latestEmaAngle(tsla, 15 / 8) ?? 0);
    const leaders = angleLeaders([
      { symbol: "AAPL", panes: { "1m": [], "5m": aapl, "15m": [] } },
      { symbol: "TSLA", panes: { "1m": [], "5m": tsla, "15m": [] } },
    ]);
    expect(leaders["5m"].down?.symbol).toBe("AAPL");
  });

  it("reads the 5m and 15m EMA angles from their own bars", () => {
    const leaders = angleLeaders([
      {
        symbol: "ORCL",
        panes: {
          "1m": rangedBars([105, 106], 100, 110),
          "5m": rangedBars([104, 108], 100, 110),
          "15m": rangedBars([102, 103], 100, 110),
        },
      },
    ]);
    expect(leaders["5m"].up?.angle).toBeGreaterThan(leaders["15m"].up?.angle ?? 0);
    expect(leaders["15m"].up?.angle).toBeGreaterThan(0);
  });

  it("reads a rise then a drop as the downward right-hand side", () => {
    const emas = [358, 358.4, 358.8, 359.2, 360, 360.6, 360.2, 359.4, 358.6];
    expect(latestEmaAngle(rangedBars(emas, 357, 364))).toBeLessThan(0);
  });

  it("reads a full-fit rise as 45 degrees and a wider pane as flatter", () => {
    const across = rangedBars([100, 110], 100, 110);
    const square = latestEmaAngle(across, 1, 2);
    const wide = latestEmaAngle(across, 15 / 8, 2);
    const unit = (10 / 0.7) / 2;
    expect(square).toBeCloseTo((Math.atan(10 / unit) * 180) / Math.PI, 4);
    expect(wide).toBeLessThan(square ?? 0);
    const leaders = angleLeaders([{ symbol: "ORCL", panes: { "1m": across, "5m": across, "15m": across } }]);
    expect(leaders["15m"].up?.angle).toBeCloseTo(latestEmaAngle(across, 1, 26) ?? 0, 4);
    expect(leaders["1m"].up?.angle).toBeCloseTo(latestEmaAngle(across, 15 / 8, 60) ?? 0, 4);
    expect(Math.abs(leaders["1m"].up?.angle ?? 0)).toBeLessThan(90);
  });

  it("measures a short open on the full pane, not on stretched candles", () => {
    const open = rangedBars([100, 101], 100, 101);
    const stretched = latestEmaAngle(open, 23 / 12, 2);
    const pane = latestEmaAngle(open, 23 / 12, 24);
    expect(pane).toBeGreaterThan(stretched ?? 0);
    expect(pane).toBeLessThan(90);
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
    expect(angleMarksFor(leaders, "nvda").map((mark) => `${mark.frame}:${mark.tone}`)).toEqual([
      "1m:up",
      "5m:down",
    ]);
    expect(angleMarksFor(leaders, "ORCL").map((mark) => `${mark.frame}:${mark.tone}`)).toEqual([
      "1m:down",
      "5m:up",
    ]);
  });

  it("names a ticker only when it leads every timeframe on that side", () => {
    const tsla = { symbol: "TSLA", angle: 12 };
    const partial = {
      "1m": { up: tsla, down: { symbol: "V", angle: -32 } },
      "5m": { up: tsla, down: { symbol: "V", angle: -17 } },
      "15m": { up: tsla, down: { symbol: "NVDA", angle: -10 } },
    };
    expect(leaderOnEveryFrame(partial)).toEqual({ up: "TSLA", down: null });
    expect(
      leaderOnEveryFrame({
        "1m": { up: tsla, down: { symbol: "V", angle: -30 } },
        "5m": { up: tsla, down: { symbol: "V", angle: -20 } },
        "15m": { up: tsla, down: { symbol: "V", angle: -8 } },
      }),
    ).toEqual({ up: "TSLA", down: "V" });
  });
});
