import { describe, expect, it } from "vitest";
import { angleOnResetScale, resetDollarsPerBar, resetPriceWindow } from "./ema-angle-scale";

describe("reset price scale", () => {
  it("fits the visible range with TradingView's top and bottom margins", () => {
    const window = resetPriceWindow(748, 752.49);
    const span = 4.49;
    const total = span / 0.7;
    expect(window.yMin).toBeCloseTo(748 - 0.1 * total, 6);
    expect(window.yMax).toBeCloseTo(752.49 + 0.2 * total, 6);
  });

  it("calls one bar 45 degrees when its rise matches the fitted pane", () => {
    const unit = resetDollarsPerBar(100, 110, 15 / 8, 60);
    expect(unit).toBeGreaterThan(0);
    expect(angleOnResetScale(unit ?? 0, 100, 110, 15 / 8, 60)).toBeCloseTo(45, 5);
    expect(angleOnResetScale((unit ?? 0) / 2, 100, 110, 15 / 8, 60)).toBeLessThan(45);
  });
});
