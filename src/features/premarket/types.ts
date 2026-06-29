export type PremarketTickerHit = {
  symbol: string;
  name?: string | null;
  qualityPct: number;
  achievedAtEt?: string;
};

export type PremarketStrategyGroup = {
  strategyId: string;
  name?: string | null;
  shortName?: string | null;
  tickers: PremarketTickerHit[];
};

export type PremarketSummary = {
  symbolsTotal?: number;
  symbolsAboveThreshold?: number;
  strategyCount?: number;
};

export type PremarketSymbolOutcome = {
  symbol: string;
  name?: string | null;
  ready?: boolean;
  error?: string | null;
};

export type PremarketResultResponse = {
  runId: string;
  status: string;
  simulationTimeEt?: string;
  tradeDate?: string;
  signalThresholdPct?: number;
  evaluatedAt?: string;
  stopped?: boolean;
  message?: string;
  summary?: PremarketSummary;
  progress?: { completed?: number; total?: number };
  strategies: PremarketStrategyGroup[];
  symbolOutcomes?: PremarketSymbolOutcome[];
};

export type PremarketStartRequest = {
  simulationTimeEt?: string;
  options?: { signalThresholdPct?: number };
};

export type PremarketStopResponse = {
  runId?: string;
  status: string;
  message?: string;
  stopRequested?: boolean;
};
