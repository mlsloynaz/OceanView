export type PreselectionTier = "excellent" | "strong" | "moderate" | "caution" | "skip";

export type PreselectionBreakdownRow = {
  key: string;
  met: boolean;
  points: number;
  maxPoints: number;
  label: string;
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
};

export type PreselectionStrategyGroup = {
  strategyId: string;
  name: string;
  shortName?: string | null;
  profileId?: string;
  tickerCount: number;
  tickers: PreselectionTickerRow[];
};

export type PreselectionCandlesMeta = {
  referenceThroughEt?: string;
  tradeDate?: string;
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
  simulationTimeEt?: string;
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
  strategies: PreselectionStrategyGroup[];
};
