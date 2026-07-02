import type { PremarketResultResponse } from "../types";

export const MOCK_PREMARKET_RESULT: PremarketResultResponse = {
  runId: "premkt-mock-001",
  status: "complete",
  simulationTimeEt: "2026-06-24T09:25:00-04:00",
  tradeDate: "2026-06-24",
  signalThresholdPct: 50,
  evaluatedAt: "2026-06-24T13:25:00.000Z",
  stopped: false,
  summary: {
    symbolsTotal: 4,
    symbolsAboveThreshold: 3,
    strategyCount: 2,
  },
  progress: { completed: 4, total: 4 },
  strategies: [
    {
      strategyId: "estrategia-01",
      name: "Hourly Trend Change",
      shortName: "Trend Change 1H",
      tickers: [
        {
          symbol: "AAPL",
          name: "Apple Inc.",
          qualityPct: 67,
          achievedAtEt: "09:22 AM",
          rules: [
            {
              ruleKey: "trendline_1h",
              label: "1H trendline",
              type: "required",
              status: "met",
              metAtEt: "09:15 AM",
            },
            {
              ruleKey: "close_ma20_alcista",
              label: "Close MA20 alcista",
              type: "required",
              status: "met",
              metAtEt: "09:22 AM",
            },
          ],
        },
        {
          symbol: "HD",
          name: "Home Depot",
          qualityPct: 55,
          achievedAtEt: "09:20 AM",
          rules: [
            {
              ruleKey: "trendline_1h",
              label: "1H trendline",
              type: "required",
              status: "met",
              metAtEt: "09:10 AM",
            },
            {
              ruleKey: "close_ma20_alcista",
              label: "Close MA20 alcista",
              type: "required",
              status: "partial",
            },
          ],
        },
      ],
    },
    {
      strategyId: "estrategia-05",
      name: "Inside Bollinger 15M",
      shortName: "Inside BB 15M",
      tickers: [
        {
          symbol: "LOW",
          name: "Lowe's",
          qualityPct: 58,
          achievedAtEt: "09:18 AM",
          rules: [
            {
              ruleKey: "close_bb_mid_15m",
              label: "Close BB mid 15m",
              type: "required",
              status: "met",
              metAtEt: "09:18 AM",
              evidence: "Within 0.3% of middle band",
            },
          ],
        },
      ],
    },
  ],
  symbolOutcomes: [
    { symbol: "AAPL", name: "Apple Inc.", ready: true, error: null },
    { symbol: "HD", name: "Home Depot", ready: true, error: null },
    { symbol: "LOW", name: "Lowe's", ready: true, error: null },
    { symbol: "TSLA", name: "Tesla", ready: true, error: null },
  ],
};

let mockRunCounter = 0;

export function nextMockPremarketStart(): PremarketResultResponse {
  mockRunCounter += 1;
  return {
    ...MOCK_PREMARKET_RESULT,
    runId: `premkt-mock-${Date.now()}`,
    message: `Mock premarket evaluate complete (run ${mockRunCounter}).`,
    evaluatedAt: new Date().toISOString(),
  };
}
