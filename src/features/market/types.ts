import type { EntryWindow } from "./lib/entry-window";
import type { AssessmentTimeMode } from "./lib/assessment-time";
import type { MovementProfile } from "@/features/premarket/types";

/** Rule definition in strategy catalog. */
export type RuleType = "required" | "extra";

export type StrategyRule = {
  id: string;
  ruleKey: string;
  label: string;
  type: RuleType;
  timeframe?: string;
  trend?: "up" | "down" | "lateral";
  operation?: "call" | "put";
};

export type StrategyCatalogItem = {
  id: string;
  name: string;
  shortName?: string;
  description: string;
  entryWindow?: EntryWindow;
  /** When false or omitted, strategy is excluded from Market grids and assess. */
  active?: boolean;
  /** standard = Market; dynamic = Premarket. Omitted on legacy mock rows. */
  tier?: "standard" | "dynamic";
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
  /** Detected regime when the rule auto-infers path (e.g. alcista / bajista). */
  suggestedTrend?: string | null;
  /** Detected CALL/PUT when the rule auto-infers path. */
  suggestedDirection?: "CALL" | "PUT" | null;
};

export type TradeDirection = "CALL" | "PUT";

export type DirectionConfidence = "high" | "medium" | "low";

export type DirectionSource =
  | "strategy_config"
  | "playbook_e01"
  | "playbook_e02"
  | "playbook_e03"
  | "playbook_e04"
  | "playbook_e05"
  | "inferred_rules"
  | "inferred_trend1h"
  | "unknown";

export type DangerStatus = "passed" | "failed" | "unknown";

export type DangerEval = {
  dangerKey: string;
  status: DangerStatus;
  penaltyPct?: number;
  evidence?: string | null;
  direction?: TradeDirection | null;
  gapUsd?: number | null;
  obstacles?: Array<{ key?: string; label?: string; level?: number }>;
};

export type StrategyAssessExtras = {
  direction?: TradeDirection | null;
  directionSource?: DirectionSource | null;
  directionConfidence?: DirectionConfidence | null;
  directionEvidence?: string | null;
  qualityPctRaw?: number | null;
  adjustedQualityPct?: number | null;
  dangerPenaltyPct?: number | null;
  qualityInvalidated?: boolean;
  dangers?: DangerEval[];
};

export type TickerStrategyEval = StrategyAssessExtras & {
  strategyId: string;
  qualityPct: number;
  metCount: number;
  totalCount: number;
  metRequired: number;
  totalRequired: number;
  /** When signal threshold was reached (ET), if applicable. */
  achievedAtEt?: string | null;
  rules: RuleEval[];
  /** Backend readiness: confirmed | near | preparing — Near uses preselection gate. */
  readiness?: string | null;
  /** True when bias rules met + MA20/BB-mid forming (E01 Near). */
  preselectionNear?: boolean | null;
  preselectionNearApplicable?: boolean | null;
};

export type TickerEvalResult = {
  symbol: string;
  name: string | null;
  strategies: TickerStrategyEval[];
  movementProfile?: MovementProfile | null;
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

export type MarketViewMode = "strategies" | "tickers" | "rules" | "alarm";

/** Modes that load Assess snapshot grids (Alarm is UI-only). */
export type MarketSnapshotMode = Exclude<MarketViewMode, "alarm">;

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
  movementProfile?: MovementProfile | null;
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
  suggestedTrend?: string | null;
  suggestedDirection?: "CALL" | "PUT" | null;
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
  /** Regular session open (9:30–close ET). */
  marketOpen?: boolean;
  paused?: boolean;
  message?: string | null;
  nextOpenEt?: string | null;
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
  movementProfile?: MovementProfile | null;
};

export type RuleSnapshotItem = RuleCardModel;

export type StrategyDetailRow = StrategyAssessExtras & {
  symbol: string;
  name: string | null;
  qualityPct: number;
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
  movementProfile?: MovementProfile | null;
};

export type MarketEvaluateRequest = {
  symbols?: string[];
  strategyIds?: string[] | null;
  tradeDate?: string;
  assessmentTimeMode?: AssessmentTimeMode;
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
