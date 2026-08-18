import { describe, expect, it } from "vitest";
import { filterSemiFinalResult } from "./search";
import type { PreselectionResultResponse } from "./types";

function result(strategies: PreselectionResultResponse["strategies"]): PreselectionResultResponse {
  return {
    runId: "r1",
    status: "complete",
    strategies,
    symbolOutcomes: [],
  } as PreselectionResultResponse;
}

describe("filterSemiFinalResult", () => {
  it("keeps empty playbook groups so E02 stays visible after a scan", () => {
    const payload = result([
      {
        strategyId: "estrategia-02",
        name: "Midpoint Bounce",
        shortName: "Midpoint Bounce",
        candidateRuleKeys: ["bb_mid_trend_d", "daily_ma_interaction_d"],
        tickerCount: 0,
        tickers: [],
      },
      {
        strategyId: "panorama-completo",
        name: "Panorama completo",
        shortName: "Panorama",
        candidateRuleKeys: [],
        tickerCount: 0,
        tickers: [],
      },
    ]);
    const filtered = filterSemiFinalResult(payload, "");
    expect(filtered?.strategies.map((g) => g.strategyId)).toEqual(["estrategia-02"]);
  });
});
