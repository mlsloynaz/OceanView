import { describe, expect, it } from "vitest";
import { buildOrbAutoWatch, diffOrbAutoWatches } from "./orb-auto-job";
import { buildOrb5mAutoWatch, diffOrb5mAutoWatches } from "./orb5m-auto-job";

describe("diff orb auto watches", () => {
  it("does not re-add a user-held 15m ticker", () => {
    const existing = [buildOrbAutoWatch("MSFT")];
    const { toAdd, toRemoveIds } = diffOrbAutoWatches(
      existing,
      ["TSLA", "MSFT", "SPY"],
      45,
      ["TSLA"],
    );
    expect(toAdd.map((w) => w.symbol)).toEqual(["SPY"]);
    expect(toRemoveIds).toEqual([]);
  });

  it("keeps a held 5m card and does not recreate it", () => {
    const existing = [buildOrb5mAutoWatch("TSLA")];
    const { toAdd, toRemoveIds } = diffOrb5mAutoWatches(
      existing,
      ["TSLA", "MSFT"],
      30,
      ["TSLA"],
    );
    expect(toAdd.map((w) => w.symbol)).toEqual(["MSFT"]);
    expect(toRemoveIds).toEqual([]);
  });
});
