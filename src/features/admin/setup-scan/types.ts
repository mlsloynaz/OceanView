export type PreselectionTier = "excellent" | "strong" | "moderate" | "caution" | "skip";

export type PreselectionCandidateMode = "eod" | "open";

export type PreselectionBreakdownRow = {
  key: string;
  met: boolean;
  points: number;
  maxPoints: number;
  label: string;
};

export type PreselectionCandidateRuleRow = {
  ruleKey: string;
  label?: string;
  type?: "required" | "bonus" | string;
  when?: "eod" | "open" | "both" | string;
  pathGroup?: string | null;
  pathVariant?: string | null;
  status: string;
  met?: boolean;
  evidence?: string | null;
  suggestedDirection?: string | null;
  suggestedTrend?: string | null;
};

export type PreselectionHintRow = {
  id?: string;
  message?: string;
  label?: string;
  severity?: string;
  level?: string;
  [key: string]: unknown;
};

export type PreselectionTickerRow = {
  symbol: string;
  name?: string | null;
  currentlyActive: boolean;
  ready: boolean;
  score: number;
  maxScore: number;
  tier: PreselectionTier | string;
  directionBias?: string | null;
  reasons: string[];
  avoidReasons: string[];
  breakdown: PreselectionBreakdownRow[];
  candidateRules?: PreselectionCandidateRuleRow[];
  requiredPassed?: boolean;
  hintNudge?: number;
  strategyHints?: PreselectionHintRow[];
  flags?: PreselectionHintRow[];
  summaryLines?: string[];
  mode?: PreselectionCandidateMode | string;
};

export type PreselectionStrategyGroup = {
  strategyId: string;
  name: string;
  shortName?: string | null;
  profileId?: string;
  candidateRuleKeys?: string[];
  tickerCount: number;
  tickers: PreselectionTickerRow[];
};

export type PreselectionStrategySuggestion = {
  strategyId: string;
  strategyName: string;
  shortName?: string | null;
  profileId?: string;
  score: number;
  maxScore: number;
  tier: PreselectionTier | string;
  reasons: string[];
  avoidReasons: string[];
  breakdown: PreselectionBreakdownRow[];
  candidateRules?: PreselectionCandidateRuleRow[];
  requiredPassed?: boolean;
  hintNudge?: number;
  strategyHints?: PreselectionHintRow[];
  flags?: PreselectionHintRow[];
  summaryLines?: string[];
};

export type PreselectionTickerGroup = {
  symbol: string;
  name?: string | null;
  directionBias: "CALL" | "PUT";
  currentlyActive: boolean;
  suggestions: PreselectionStrategySuggestion[];
};

export type PreselectionCandlesMeta = {
  referenceThroughEt?: string;
  tradeDate?: string;
  simulationDate?: string | null;
  simulated?: boolean;
  symbolsTotal?: number;
  symbolsStale?: number;
  symbolsRefreshed?: number;
  skippedRefresh?: boolean;
  refreshedSymbols?: string[];
  failed?: { symbol: string; message: string }[];
};

export type GapForecastBias =
  | "gap_up_high"
  | "gap_up_moderate"
  | "no_edge"
  | "gap_down_moderate"
  | "gap_down_high";

export type GapForecastTickerRow = {
  symbol: string;
  name?: string | null;
  ready: boolean;
  score: number;
  bias: GapForecastBias | string;
  label: string;
  close?: number | null;
  reasons?: string[];
  breakdown?: { key: string; points: number; evidence: string }[];
  error?: string | null;
};

export type GapForecastResult = {
  runId?: string | null;
  status: string;
  message?: string;
  asOfEt?: string;
  tradeDate?: string;
  evaluatedAt?: string;
  simulated?: boolean;
  simulationDate?: string | null;
  progress?: { done?: number; total?: number };
  summary?: {
    symbolsTotal?: number;
    symbolsReady?: number;
    refreshedCount?: number;
    counts?: Partial<Record<GapForecastBias, number>>;
  };
  tickers?: GapForecastTickerRow[];
  gapUpHigh?: GapForecastTickerRow[];
  gapUpModerate?: GapForecastTickerRow[];
  noEdge?: GapForecastTickerRow[];
  gapDownModerate?: GapForecastTickerRow[];
  gapDownHigh?: GapForecastTickerRow[];
};

export type PreselectionResultResponse = {
  runId: string;
  status: string;
  message?: string;
  mode?: PreselectionCandidateMode | string;
  visualOnly?: boolean;
  simulationTimeEt?: string;
  simulationDate?: string | null;
  simulated?: boolean;
  tradeDate?: string;
  evaluatedAt?: string;
  minScore?: number;
  progress?: { done?: number; total?: number };
  candles?: PreselectionCandlesMeta;
  summary?: {
    symbolsTotal?: number;
    symbolsReady?: number;
    strategyCount?: number;
  };
  strategies?: PreselectionStrategyGroup[];
  /** Latest 15:25 overnight gap forecast for active tickers. */
  gapForecast?: GapForecastResult | null;
};
