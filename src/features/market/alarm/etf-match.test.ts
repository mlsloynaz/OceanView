import { describe, expect, it } from "vitest";
import { fiveMinuteMove } from "./ActiveTickerBoard";

describe("five minute move", () => {
  it("reads the last two closes", () => {
    expect(fiveMinuteMove([10, 11])).toBe(1);
    expect(fiveMinuteMove([11, 10])).toBe(-1);
    expect(fiveMinuteMove([10])).toBeNull();
  });
});
