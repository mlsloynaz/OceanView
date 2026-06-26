/** Rule definition in strategy catalog. */
export type RuleType = "required" | "extra";

export type StrategyRule = {
  id: string;
  ruleKey: string;
  label: string;
  type: RuleType;
  timeframe?: string;
};

export type StrategyCatalogItem = {
  id: string;
  name: string;
  shortName?: string;
  description: string;
  entryWindow?: string;
  rules: StrategyRule[];
};

export type StrategiesCatalogFile = {
  version: string;
  updatedAt: string;
  strategies: StrategyCatalogItem[];
};

/** Per-rule evaluation status (UI icons). */
export type RuleStatus = "met" | "partial" | "not_met" | "pending" | "about_to_cross";

export type RuleEval = {
  ruleKey: string;
  status: RuleStatus;
  metAtEt?: string | null;
  evidence?: string | null;
};

export type TradeDirection = "CALL" | "PUT";

export type TickerStrategyEval = {
  strategyId: string;
  qualityPct: number;
  direction: TradeDirection | null;
  metCount: number;
  totalCount: number;
  metRequired: number;
  totalRequired: number;
  /** When signal threshold was reached (ET), if applicable. */
  achievedAtEt?: string | null;
  rules: RuleEval[];
};

export type TickerEvalResult = {
  symbol: string;
  name: string | null;
  strategies: TickerStrategyEval[];
};

export type CandleCoverage = {
  timezone: string;
  /** ISO8601 — earliest bar timestamp available across the evaluated universe. */
  earliestAt: string;
  /** ISO8601 — latest bar timestamp (often last closed bar or now during session). */
  latestAt: string;
};

export type MarketSnapshotFile = {
  version: string;
  evaluatedAt: string;
  tradeDate: string;
  signalThresholdPct: number;
  /** Window where historical assessment is valid (from collected candles). */
  candleCoverage?: CandleCoverage;
  results: TickerEvalResult[];
};

export type MarketViewMode = "strategies" | "tickers" | "rules";

/** Derived view model for strategy thumbnail grid. */
export type StrategyCardModel = {
  strategy: StrategyCatalogItem;
  signalCount: number;
  previewTickers: { symbol: string; qualityPct: number }[];
};

/** Derived view model for ticker thumbnail grid. */
export type TickerCardModel = {
  symbol: string;
  name: string | null;
  signalCount: number;
  bestSignal: { strategyId: string; strategyName: string; qualityPct: number; direction: TradeDirection | null } | null;
  topStrategyEval: TickerStrategyEval | null;
};

/** Derived view model for rule thumbnail grid (By rule). */
export type RuleCardModel = {
  ruleKey: string;
  label: string;
  type: RuleType;
  timeframe?: string;
  strategyId: string;
  strategyName: string;
  metCount: number;
  totalSymbols: number;
  previewSymbols: { symbol: string; status: RuleStatus; metAtEt?: string | null }[];
};

/** Expanded rule row for detail panels. */
export type RuleDisplayRow = {
  ruleKey: string;
  label: string;
  type: RuleType;
  status: RuleStatus;
  metAtEt?: string | null;
  evidence?: string | null;
};
