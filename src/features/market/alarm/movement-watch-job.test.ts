import { describe, expect, it } from "vitest";
import type { MarketAlarmWatch } from "./alarm-types";
import {
  findManualMovementComboWatch,
  movementWatchAutoCovers,
  movementWatchJobCovers,
} from "./movement-watch-job";

function watch(
  partial: Partial<MarketAlarmWatch> & Pick<MarketAlarmWatch, "symbol" | "ruleKey">,
): MarketAlarmWatch {
  return {
    id: partial.id ?? "w1",
    symbol: partial.symbol,
    ruleKey: partial.ruleKey,
    ruleKeys: partial.ruleKeys ?? [partial.ruleKey],
    ruleLabel: partial.ruleLabel ?? partial.ruleKey,
    trend: "auto",
    frequencyValue: 1,
    frequencyUnit: "min",
    status: partial.status ?? "idle",
    lastRuleStatus: null,
    lastEvidence: null,
    lastCheckedAt: null,
    lastError: null,
    metAt: null,
    movementWatch: partial.movementWatch,
  };
}

describe("movement watch combo helpers", () => {
  it("detects job coverage", () => {
    expect(
      movementWatchJobCovers(
        {
          status: "running",
          symbols: ["AAPL", "MSFT"],
          ruleKeys: ["trend_change_5m", "ema_cross_5m"],
        },
        "aapl",
        "trend_change_5m",
      ),
    ).toBe(true);
    expect(
      movementWatchJobCovers(
        {
          status: "running",
          symbols: ["AAPL"],
          ruleKeys: ["trend_change_5m"],
        },
        "AAPL",
        "ema_cross_5m",
      ),
    ).toBe(false);
    expect(
      movementWatchJobCovers(
        { status: "idle", symbols: ["AAPL"], ruleKeys: ["trend_change_5m"] },
        "AAPL",
        "trend_change_5m",
      ),
    ).toBe(false);
  });

  it("detects auto watch rows", () => {
    const rows = [
      watch({
        symbol: "TSLA",
        ruleKey: "trend_change_15m",
        movementWatch: true,
      }),
    ];
    expect(movementWatchAutoCovers(rows, "TSLA", "trend_change_15m")).toBe(true);
    expect(movementWatchAutoCovers(rows, "TSLA", "ema_cross_5m")).toBe(false);
  });

  it("finds manual combo watches only", () => {
    const rows = [
      watch({
        symbol: "NVDA",
        ruleKey: "ema_cross_5m",
        movementWatch: true,
      }),
      watch({
        id: "manual-1",
        symbol: "NVDA",
        ruleKey: "ema_cross_5m",
        status: "running",
      }),
    ];
    expect(findManualMovementComboWatch(rows, "NVDA", "ema_cross_5m")?.id).toBe("manual-1");
    expect(findManualMovementComboWatch(rows, "NVDA", "trend_change_5m")).toBeUndefined();
  });
});
