import { describe, expect, it } from "vitest";
import { fiveMinuteMove, handoffBars } from "./ActiveTickerBoard";
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
