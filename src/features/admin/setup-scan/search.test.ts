import { describe, expect, it } from "vitest";
import { filterSemiFinalResult, isSemiFinalDisplayableTicker } from "./search";
import type { PreselectionResultResponse, PreselectionTickerRow } from "./types";

function result(strategies: PreselectionResultResponse["strategies"]): PreselectionResultResponse {
  return {
    runId: "r1",
    status: "complete",
    strategies,
    symbolOutcomes: [],
  } as PreselectionResultResponse;
}

function ticker(
  partial: Partial<PreselectionTickerRow> & Pick<PreselectionTickerRow, "symbol">,
): PreselectionTickerRow {
  return {
    symbol: partial.symbol,
    name: partial.name ?? partial.symbol,
    score: partial.score ?? 1,
    maxScore: partial.maxScore ?? 1,
    tier: partial.tier ?? "A",
    reasons: partial.reasons ?? [],
    avoidReasons: partial.avoidReasons ?? [],
    breakdown: partial.breakdown ?? [],
    currentlyActive: partial.currentlyActive ?? false,
    directionBias: partial.directionBias,
    requiredPassed: partial.requiredPassed,
    candidateRules: partial.candidateRules,
  } as PreselectionTickerRow;
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

  it("keeps undirected EOD watches (null directionBias) when required rules passed", () => {
    const payload = result([
      {
        strategyId: "estrategia-04",
        name: "Lateral BB15 + Gap",
        shortName: "E04",
        candidateRuleKeys: ["bb_lateral_squeeze_15m"],
        tickerCount: 1,
        tickers: [
          ticker({
            symbol: "AMZN",
            directionBias: null,
            requiredPassed: true,
            candidateRules: [{ key: "bb_lateral_squeeze_15m", met: true, label: "BB lateral" }],
          }),
        ],
      },
    ]);
    const filtered = filterSemiFinalResult(payload, "");
    expect(filtered?.strategies[0]?.tickers.map((t) => t.symbol)).toEqual(["AMZN"]);
  });

  it("drops undirected rows that failed a candidate rule", () => {
    const row = ticker({
      symbol: "FAIL",
      directionBias: null,
      requiredPassed: true,
      candidateRules: [{ key: "bb_lateral_squeeze_15m", met: false, label: "BB lateral" }],
    });
    expect(isSemiFinalDisplayableTicker(row)).toBe(false);
  });
});
