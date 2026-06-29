import type { EntryWindow } from "./lib/entry-window";

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
  entryWindow?: EntryWindow;
  /** When false or omitted, strategy is excluded from Market grids and assess. */
  active?: boolean;
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
  previewTickers: { symbol: string; qualityPct: number; achievedAtEt?: string }[];
};

/** Derived view model for ticker thumbnail grid. */
export type TickerCardModel = {
  symbol: string;
  name: string | null;
  signalCount: number;
  bestSignal: {
    strategyId: string;
    strategyName: string;
    qualityPct: number;
    direction: TradeDirection | null;
    achievedAtEt?: string;
  } | null;
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

export type MarketEnvelopeStatus = "complete" | "running" | "failed" | "stale";

export type MarketEnvelopeSummary = {
  strategyCount: number;
  tickerCount: number;
  activeSignals: number;
  ruleCount?: number;
};

export type MarketEnvelope = {
  runId: string | null;
  evaluatedAt: string | null;
  simulationTimeEt: string | null;
  tradeDate: string;
  signalThresholdPct: number;
  catalogVersion: string;
  status: MarketEnvelopeStatus;
  candleCoverage: CandleCoverage;
  summary: MarketEnvelopeSummary;
};

export type StrategySnapshotItem = {
  strategyId: string;
  name: string;
  shortName?: string;
  entryWindow?: EntryWindow;
  signalCount: number;
  previewTickers: { symbol: string; qualityPct: number; achievedAtEt?: string }[];
};

export type TickerSnapshotItem = {
  symbol: string;
  name: string | null;
  signalCount: number;
  bestSignal: TickerCardModel["bestSignal"];
  topStrategyEval?: {
    strategyId: string;
    qualityPct: number;
    rules: RuleEval[];
  } | null;
};

export type RuleSnapshotItem = RuleCardModel;

export type StrategyDetailRow = {
  symbol: string;
  name: string | null;
  qualityPct: number;
  direction: TradeDirection | null;
  metCount: number;
  totalCount: number;
  metRequired?: number;
  totalRequired?: number;
  achievedAtEt?: string | null;
  rules: RuleDisplayRow[];
};

export type StrategyDetailResponse = {
  strategy: StrategyCatalogItem;
  runId: string;
  rows: StrategyDetailRow[];
};

export type TickerDetailStrategyRow = TickerStrategyEval & {
  rules: RuleDisplayRow[];
};

export type TickerDetailResponse = {
  symbol: string;
  name: string | null;
  runId: string;
  strategies: TickerDetailStrategyRow[];
};

export type MarketEvaluateRequest = {
  symbols?: string[];
  strategyIds?: string[] | null;
  tradeDate?: string;
  simulationTimeEt?: string;
  options?: { signalThresholdPct?: number };
};

export type MarketEvaluateResponse = {
  runId: string;
  status: string;
  message?: string;
  symbols?: string[];
  strategyIds?: string[] | null;
  assessment?: MarketSnapshotFile;
};

export type MarketEvaluateStatusResponse = {
  runId: string;
  status: string;
  progress?: { completed?: number; total?: number } | null;
  summary?: Record<string, unknown> | null;
  assessment?: MarketSnapshotFile | null;
};
