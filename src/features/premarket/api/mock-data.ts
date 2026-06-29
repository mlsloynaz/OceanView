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
        { symbol: "AAPL", name: "Apple Inc.", qualityPct: 67 },
        { symbol: "HD", name: "Home Depot", qualityPct: 55 },
      ],
    },
    {
      strategyId: "estrategia-05",
      name: "Inside Bollinger 15M",
      shortName: "Inside BB 15M",
      tickers: [{ symbol: "LOW", name: "Lowe's", qualityPct: 58 }],
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
