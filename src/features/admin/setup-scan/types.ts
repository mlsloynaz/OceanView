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
};
