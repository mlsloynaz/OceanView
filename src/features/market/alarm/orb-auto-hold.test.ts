import { afterEach, describe, expect, it } from "vitest";
import {
  clearOrbAutoHolds,
  heldOrbAutoSymbols,
  holdOrbAutoSymbol,
  isOrbAutoSymbolHeld,
  releaseOrbAutoSymbol,
} from "./orb-auto-hold";

afterEach(() => {
  clearOrbAutoHolds();
});

describe("orb auto hold", () => {
  it("keeps a stopped 5m ticker held until released", () => {
    holdOrbAutoSymbol("orb5m", "tsla");
    expect(isOrbAutoSymbolHeld("orb5m", "TSLA")).toBe(true);
    expect(heldOrbAutoSymbols("orb5m").has("TSLA")).toBe(true);
    expect(isOrbAutoSymbolHeld("orb15", "TSLA")).toBe(false);

    releaseOrbAutoSymbol("orb5m", "TSLA");
    expect(isOrbAutoSymbolHeld("orb5m", "TSLA")).toBe(false);
  });

  it("does not treat a 15m hold as a 5m hold", () => {
    holdOrbAutoSymbol("orb15", "MSFT");
    expect(isOrbAutoSymbolHeld("orb15", "MSFT")).toBe(true);
    expect(isOrbAutoSymbolHeld("orb5m", "MSFT")).toBe(false);
  });
});
