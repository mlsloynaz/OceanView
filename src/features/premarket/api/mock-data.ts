import type { DynamicCatalogResponse, DynamicRuleTemplate } from "./dynamic-strategy-client";
import type { PremarketResultResponse } from "../types";

/** Representative rule library for mock premarket (offline builder). */
export const MOCK_DYNAMIC_RULES: DynamicRuleTemplate[] = [
  {
    ruleKey: "bb_mid_trend_onspot_15m",
    label: "Bollinger mid trend on the candle (15M)",
    defaultType: "required",
    timeframe: "15m",
  },
  {
    ruleKey: "bb_mid_trend_15m",
    label: "Tendencia punto medio Bollinger (15M)",
    defaultType: "required",
    timeframe: "15m",
  },
  {
    ruleKey: "open_inside_bb_15m",
    label: "Apertura dentro de Bollinger (15M)",
    defaultType: "required",
    timeframe: "15m",
  },
  {
    ruleKey: "close_bb_mid_15m",
    label: "Close BB mid 15m",
    defaultType: "required",
    timeframe: "15m",
  },
  {
    ruleKey: "trendline_1h",
    label: "1H trendline",
    defaultType: "required",
    timeframe: "1h",
  },
  {
    ruleKey: "vol_bb_expand_15m",
    label: "Volatilidad Bollinger abierta en 15M (disipadores expandiendo)",
    defaultType: "required",
    timeframe: "15m",
  },
  {
    ruleKey: "volume_stoch_15m",
    label: "Volumen en 15M cruza la línea roja (Worden Stochastics)",
    defaultType: "required",
    timeframe: "15m",
  },
  {
    ruleKey: "volume_stoch_1h",
    label: "Volumen en HORA cruza la línea roja (Worden Stochastics)",
    defaultType: "required",
    timeframe: "1h",
  },
];

export const MOCK_DYNAMIC_CATALOG: DynamicCatalogResponse = {
  version: "1",
  catalogKind: "unified",
  strategies: [
    {
      id: "estrategia-01",
      name: "Hourly Trend Change",
      shortName: "Trend Change 1H",
      tier: "standard",
      active: true,
      rules: [
        {
          id: "estrategia-01-close_ma20_bajista_1h",
          ruleKey: "close_ma20_bajista_1h",
          label: "MA20 bajista 1h",
          type: "required",
          timeframe: "1h",
        },
      ],
    },
    {
      id: "estrategia-05",
      name: "Inside Bollinger 15M",
      shortName: "Inside BB 15M",
      tier: "standard",
      active: true,
      rules: [
        {
          id: "estrategia-05-close_bb_mid_15m",
          ruleKey: "close_bb_mid_15m",
          label: "Close BB mid 15m",
          type: "required",
          timeframe: "15m",
        },
      ],
    },
    {
      id: "dyn-mock-screen",
      name: "Mock premarket screen",
      tier: "dynamic",
      active: true,
      rules: [
        {
          id: "dyn-mock-screen-close_bb_mid_15m",
          ruleKey: "close_bb_mid_15m",
          label: "Close BB mid 15m",
          type: "required",
          timeframe: "15m",
        },
      ],
    },
  ],
};

export const MOCK_PREMARKET_RESULT: PremarketResultResponse = {
  runId: "premkt-mock-001",
  status: "complete",
  simulationTimeEt: "2026-06-24T09:25:00-04:00",
  tradeDate: "2026-06-24",
  signalThresholdPct: 0,
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
          qualityPct: 61,
          qualityPctRaw: 67,
          dangerPenaltyPct: -5.5,
          direction: "CALL",
          directionEvidence: "E01: tendencia HORA bajista previa → ruptura al alza → CALL.",
          directionConfidence: "high",
          achievedAtEt: "09:22 AM",
          dangers: [
            {
              dangerKey: "clear_path",
              status: "failed",
              penaltyPct: 5.5,
              direction: "CALL",
              evidence: "Camino libre CALL: $2.40 antes de MA40 1h ($182.50).",
              gapUsd: 2.4,
            },
          ],
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
      name: "Inside BB 15M_Pre",
      shortName: "Inside BB 15M_Pre",
      tickers: [
        {
          symbol: "AAPL",
          name: "Apple Inc.",
          qualityPct: 0,
          direction: "CALL",
          directionEvidence: "BB mid on-spot slope up → CALL.",
          rules: [
            {
              ruleKey: "open_inside_bb_15m",
              label: "Apertura dentro de Bollinger (15M)",
              type: "required",
              status: "not_met",
              evidence:
                "Open 214.50 outside BB [212.10, 214.20] @ 2026-06-24 09:30:00.",
            },
            {
              ruleKey: "vol_bb_expand_15m",
              label: "Volatilidad Bollinger abierta en 15M (disipadores expandiendo)",
              type: "required",
              status: "not_met",
              evidence:
                "15m vol expansion normal_or_weak: BB width 1.85% (index 1.08 vs avg 1.71%), ATR ratio 0.92 (need index>=1.35, ATR>=1.20).",
            },
            {
              ruleKey: "bb_mid_cut_15m",
              label: "Corte punto medio BB",
              type: "required",
              status: "not_met",
              evidence: "15m BB mid cut not met @ 2026-06-24 09:30:00.",
            },
            {
              ruleKey: "trend_cut_15m",
              label: "Trend Cut",
              type: "required",
              status: "not_met",
              evidence: "15m trend cut pending confirm @ 2026-06-24 09:30:00.",
            },
          ],
        },
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
