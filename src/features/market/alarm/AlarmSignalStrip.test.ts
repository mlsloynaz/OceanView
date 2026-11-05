import { describe, expect, it } from "vitest";
import { alarmStripLanes, alarmStripTags } from "./AlarmSignalStrip";
import type { AlarmPopupState, MarketAlarmWatch } from "./alarm-types";

function watch(partial: Partial<MarketAlarmWatch> & Pick<MarketAlarmWatch, "id" | "symbol">): MarketAlarmWatch {
  return {
    ruleKey: "trend_change_5m",
    ruleKeys: ["trend_change_5m"],
    ruleLabel: "5m",
    trend: "auto",
    frequencyValue: 1,
    frequencyUnit: "min",
    status: "met",
    lastRuleStatus: null,
    lastEvidence: null,
    lastCheckedAt: null,
    lastError: null,
    metAt: null,
    ...partial,
  };
}

describe("alarm strip", () => {
  it("lists the highest estimated earning first", () => {
    const popup: AlarmPopupState = {
      kind: "enter",
      watch: watch({ id: "a", symbol: "AAA" }),
      poolEntries: [
        {
          watchId: "b",
          symbol: "BBB",
          ruleLabel: "5m",
          sideLabel: "bajista",
          earningPct: 12,
          isTop: false,
          watch: watch({ id: "b", symbol: "BBB" }),
        },
        {
          watchId: "a",
          symbol: "AAA",
          ruleLabel: "5m",
          sideLabel: "alcista",
          earningPct: 40,
          isTop: true,
          watch: watch({ id: "a", symbol: "AAA" }),
        },
      ],
    };
    const tags = alarmStripTags(popup);
    expect(tags.map((tag) => tag.symbol)).toEqual(["AAA", "BBB"]);
    expect(tags[0]?.operation).toBe("Buy Call");
    expect(tags[1]?.operation).toBe("Buy Put");
    expect(alarmStripLanes(tags).trend.map((tag) => tag.symbol)).toEqual(["AAA", "BBB"]);
    expect(alarmStripLanes(tags).orb).toEqual([]);
  });

  it("keeps the 5-minute ORB break on its own stripe", () => {
    const popup: AlarmPopupState = {
      kind: "enter",
      watch: watch({ id: "orb", symbol: "NVDA", ruleKey: "orb_breakout_5m", ruleKeys: ["orb_breakout_5m"] }),
      poolEntries: [
        {
          watchId: "orb",
          symbol: "NVDA",
          ruleLabel: "ORB",
          sideLabel: "alcista",
          earningPct: 20,
          isTop: true,
          watch: watch({ id: "orb", symbol: "NVDA", ruleKey: "orb_breakout_5m", ruleKeys: ["orb_breakout_5m"] }),
        },
        {
          watchId: "trend",
          symbol: "AAPL",
          ruleLabel: "5m",
          sideLabel: "bajista",
          earningPct: 10,
          isTop: false,
          watch: watch({ id: "trend", symbol: "AAPL" }),
        },
      ],
    };
    const lanes = alarmStripLanes(alarmStripTags(popup));
    expect(lanes.orb.map((tag) => tag.symbol)).toEqual(["NVDA"]);
    expect(lanes.trend.map((tag) => tag.symbol)).toEqual(["AAPL"]);
  });
});
