import { describe, expect, it } from "vitest";
import {
  buildSemifinalMonitorQueue,
  groupSemifinalMonitorQueue,
} from "@/features/admin/setup-scan/semifinal-monitor-queue";
import type { PreselectionResultResponse } from "@/features/admin/setup-scan/types";

function baseResult(
  overrides: Partial<PreselectionResultResponse> = {},
): PreselectionResultResponse {
  return {
    runId: "presel-test",
    status: "complete",
    mode: "open",
    tradeDate: "2026-08-13",
    strategies: [],
    ...overrides,
  };
}

describe("buildSemifinalMonitorQueue", () => {
  it("admits active tickers when setup met even if confirm is not", () => {
    const queue = buildSemifinalMonitorQueue(
      baseResult({
        strategies: [
          {
            strategyId: "estrategia-01",
            name: "Hourly Trend Change",
            shortName: "E01",
            tickerCount: 1,
            tickers: [
              {
                symbol: "AAPL",
                currentlyActive: true,
                ready: true,
                score: 10,
                maxScore: 10,
                tier: "strong",
                directionBias: "CALL",
                reasons: [],
                avoidReasons: [],
                breakdown: [],
                requiredPassed: false,
                candidateRules: [
                  {
                    ruleKey: "bb_mid_trend_1h_prior",
                    type: "required",
                    status: "met",
                    met: true,
                    label: "Prior bajista",
                  },
                  {
                    ruleKey: "confirmation_change_trend_1h",
                    type: "required",
                    status: "not_met",
                    met: false,
                    label: "Confirm",
                  },
                ],
              },
            ],
          },
        ],
      }),
    );

    expect(queue).toHaveLength(1);
    expect(queue[0]?.confirmRuleKey).toBe("confirmation_change_trend_1h");
    expect(queue[0]?.startEt).toBe("09:31");
    expect(queue[0]?.scheduleSummary).toMatch(/9:31/);
    expect(queue[0]?.frequencyValue).toBe(1);
    expect(queue[0]?.frequencyUnit).toBe("hour");
    expect(queue[0]?.setupMet).toContain("Prior bajista");
  });

  it("groups by confirmation rule", () => {
    const queue = buildSemifinalMonitorQueue(
      baseResult({
        strategies: [
          {
            strategyId: "estrategia-01",
            name: "E01",
            shortName: "E01",
            tickerCount: 1,
            tickers: [
              {
                symbol: "AAPL",
                currentlyActive: true,
                ready: true,
                score: 10,
                maxScore: 10,
                tier: "strong",
                directionBias: "CALL",
                reasons: [],
                avoidReasons: [],
                breakdown: [],
                requiredPassed: true,
                candidateRules: [
                  {
                    ruleKey: "bb_mid_trend_1h_prior",
                    type: "required",
                    status: "met",
                    met: true,
                  },
                ],
              },
            ],
          },
          {
            strategyId: "estrategia-02",
            name: "Midpoint Bounce",
            shortName: "E02",
            tickerCount: 1,
            tickers: [
              {
                symbol: "MSFT",
                currentlyActive: true,
                ready: true,
                score: 10,
                maxScore: 10,
                tier: "strong",
                directionBias: "CALL",
                reasons: [],
                avoidReasons: [],
                breakdown: [],
                requiredPassed: true,
                candidateRules: [
                  {
                    ruleKey: "bb_mid_trend_d",
                    type: "required",
                    status: "met",
                    met: true,
                  },
                ],
              },
            ],
          },
          {
            strategyId: "estrategia-03",
            name: "Magnet",
            shortName: "E03",
            tickerCount: 1,
            tickers: [
              {
                symbol: "NVDA",
                currentlyActive: true,
                ready: true,
                score: 10,
                maxScore: 10,
                tier: "strong",
                directionBias: "PUT",
                reasons: [],
                avoidReasons: [],
                breakdown: [],
                requiredPassed: true,
                candidateRules: [
                  {
                    ruleKey: "ma_separation_1h",
                    type: "required",
                    status: "met",
                    met: true,
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
    const groups = groupSemifinalMonitorQueue(queue);
    expect(groups).toHaveLength(3);
    expect(groups.map((g) => g.confirmRuleKey).sort()).toEqual([
      "confirmation_change_trend_1h",
      "daily_ma_bounce_confirm_1h",
      "volume_stoch_1h",
    ]);
  });
});
