import { describe, expect, it } from "vitest";
import { charlesCallLabel, schwabRefreshCooldownMs } from "./schwab-refresh";

describe("schwabRefreshCooldownMs", () => {
  it("uses the shortest interval when several alarms share a ticker", () => {
    expect(schwabRefreshCooldownMs([30_000, 5 * 60_000])).toBe(30_000);
  });

  it("keeps a ticker's own interval when nothing is faster", () => {
    expect(schwabRefreshCooldownMs([5 * 60_000])).toBe(5 * 60_000);
  });

  it("does not pull faster than 15 seconds", () => {
    expect(schwabRefreshCooldownMs([5_000, 30_000])).toBe(15_000);
  });

  it("falls back to one minute when no alarm interval is set", () => {
    expect(schwabRefreshCooldownMs([])).toBe(60_000);
  });
});

describe("charlesCallLabel", () => {
  it("shows the shortest polling interval for that ticker only", () => {
    const watches = [
      { symbol: "AAPL", status: "running", frequencyValue: 30, frequencyUnit: "sec" as const },
      { symbol: "AAPL", status: "running", frequencyValue: 5, frequencyUnit: "min" as const },
      { symbol: "GOOG", status: "running", frequencyValue: 5, frequencyUnit: "min" as const },
      { symbol: "MSFT", status: "stopped", frequencyValue: 30, frequencyUnit: "sec" as const },
    ];
    expect(charlesCallLabel(watches, "AAPL")).toBe("every 30s");
    expect(charlesCallLabel(watches, "GOOG")).toBe("every 5 min");
    expect(charlesCallLabel(watches, "MSFT")).toBeNull();
  });
});
