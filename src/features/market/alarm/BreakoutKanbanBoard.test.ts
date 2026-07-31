import { describe, expect, it } from "vitest";
import { breakoutKanbanColumn, watchHasBreakout } from "./BreakoutKanbanBoard";
import type { MarketAlarmWatch } from "./alarm-types";

describe("breakoutKanbanColumn", () => {
  const base: MarketAlarmWatch = {
    id: "1",
    symbol: "NFLX",
    ruleKey: "breakout_quality",
    ruleKeys: ["breakout_quality"],
    ruleLabel: "Breakout quality",
    trend: "auto",
    frequencyValue: 30,
    frequencyUnit: "sec",
    status: "running",
    lastRuleStatus: null,
    lastEvidence: null,
    lastCheckedAt: null,
    lastError: null,
    metAt: null,
  };

  it("maps lifecycle to columns", () => {
    expect(breakoutKanbanColumn({ ...base, lastLifecycle: "setup_forming" })).toBe("setup");
    expect(breakoutKanbanColumn({ ...base, lastLifecycle: "testing_level" })).toBe("testing");
    expect(breakoutKanbanColumn({ ...base, lastLifecycle: "awaiting_entry" })).toBe("confirmed");
    expect(breakoutKanbanColumn({ ...base, lastLifecycle: "confirmed" })).toBe("confirmed");
    expect(breakoutKanbanColumn({ ...base, lastLifecycle: "entry_ready" })).toBe("entry");
  });

  it("puts enter/exit/in_trade in Entry", () => {
    expect(breakoutKanbanColumn({ ...base, status: "met" })).toBe("entry");
    expect(breakoutKanbanColumn({ ...base, status: "in_trade" })).toBe("entry");
    expect(breakoutKanbanColumn({ ...base, status: "exit" })).toBe("entry");
  });

  it("detects breakout watches", () => {
    expect(watchHasBreakout(base)).toBe(true);
    expect(
      watchHasBreakout({
        ...base,
        ruleKey: "confirmation_change_trend_1h",
        ruleKeys: ["confirmation_change_trend_1h"],
      }),
    ).toBe(false);
  });
});
