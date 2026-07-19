import type { StrategyAssessExtras, TradeDirection } from "@/features/market/types";

export type PremarketRuleRow = {
  ruleKey: string;
  label: string;
  type: string;
  status: string;
  metAtEt?: string | null;
  evidence?: string | null;
  trend?: "up" | "down" | "lateral";
  operation?: "call" | "put";
  suggestedTrend?: string | null;
  suggestedDirection?: "CALL" | "PUT" | null;
};

export type PremarketTickerHit = StrategyAssessExtras & {
  symbol: string;
  name?: string | null;
  qualityPct: number;
  achievedAtEt?: string;
  rules?: PremarketRuleRow[];
  movementProfile?: MovementProfile | null;
};

export type PremarketStrategyGroup = {
  strategyId: string;
  name?: string | null;
  shortName?: string | null;
  description?: string | null;
  isMovement?: boolean;
  tickers: PremarketTickerHit[];
};

/** One strategy contribution inside a Best-results merged row. */
export type PremarketStrategyScore = {
  strategyId: string;
  label: string;
  qualityPct: number;
  isMovement?: boolean;
};

/** Compact foundation movement profile (ticker-specific move length). */
export type MaDistanceProfile = {
  sampleSize?: number;
  typicalMa20DistancePct?: number | null;
  typicalMa40DistancePct?: number | null;
  typicalMaStackSepPct?: number | null;
  p75Ma20DistancePct?: number | null;
  p90Ma20DistancePct?: number | null;
  p75Ma40DistancePct?: number | null;
  p90Ma40DistancePct?: number | null;
  ma20DistancePct?: number | null;
  ma40DistancePct?: number | null;
  ma20SignedPct?: number | null;
  ma40SignedPct?: number | null;
  ma20DistancePercentile?: number | null;
  ma40DistancePercentile?: number | null;
  maStackSepPct?: number | null;
  maStackSepPercentile?: number | null;
  ma20?: number | null;
  ma40?: number | null;
  maExtended?: boolean;
};

export type MovementProfile = {
  timeframe?: string;
  sampleSize?: number;
  horizonBars?: number | null;
  historyStart?: string | null;
  historyEnd?: string | null;
  moveCapPct?: number | null;
  stretchMoveCapPct?: number | null;
  moveCapRemainingPct?: number | null;
  expectedMfePct?: number | null;
  expectedMaePct?: number | null;
  p75MfePct?: number | null;
  p90MfePct?: number | null;
  expectedExitPrice?: number | null;
  stretchExitPrice?: number | null;
  /**
   * Ordered stock exit targets when Camino libre is not viable.
   * Last entry is the movement-profile estimate when present.
   */
  expectedExitPrices?: number[] | null;
  referencePrice?: number | null;
  sequenceEntryPrice?: number | null;
  remainingMfePct?: number | null;
  currentMfePct?: number | null;
  exhaustionRisk?: boolean;
  extensionPercentile?: number | null;
  barsOutside?: number;
  direction?: string | null;
  reachProb?: Record<string, number | null>;
  maDistance?: MaDistanceProfile | null;
  warnings?: string[];
  reasons?: string[];
};

/** API BestResult row (persisted on premarket evaluate context). */
export type PremarketBestResultRow = {
  symbol: string;
  name?: string | null;
  direction?: TradeDirection | null;
  qualityPct: number;
  /** Count of preferred-pool strategies at 100% (same-direction concurrence). */
  agreementCount?: number;
  strategies: PremarketStrategyScore[];
  movementProfile?: MovementProfile | null;
};

/**
 * UI Best-results hit: API row plus refs for the detail modal
 * (highest-% strategy group/ticker).
 */
export type PremarketBestHit = PremarketBestResultRow & {
  bestGroup: PremarketStrategyGroup;
  bestTicker: PremarketTickerHit;
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
  /** BestResult feature — top tickers by max quality (API); optional on older runs. */
  bestResults?: PremarketBestResultRow[];
  symbolOutcomes?: PremarketSymbolOutcome[];
  /** Server hint — job still running (includes early `ready`). */
  jobActive?: boolean;
  /** Server hint — Stop endpoint will accept this run. */
  canStop?: boolean;
};

export type PremarketStartRequest = {
  assessmentTimeMode?: import("@/features/market/lib/assessment-time").AssessmentTimeMode;
  simulationTimeEt?: string;
  options?: { signalThresholdPct?: number };
};

export type PremarketStopResponse = {
  runId?: string;
  status: string;
  message?: string;
  stopRequested?: boolean;
};

/** Live COGER pick from BestResult strike monitor. */
export type BestResultStrikePick = {
  symbol?: string;
  optionSymbol?: string | null;
  direction?: TradeDirection | null;
  strike: number;
  expiration?: string | null;
  dte?: number;
  ask: number;
  bid?: number;
  mark?: number;
  delta?: number | null;
  distancePct?: number;
  tomar?: boolean;
  rating?: number;
  rent?: number;
  pv10?: number;
  pv35?: number;
};

export type BestResultMoveEstimate = {
  atMoveCapPct: number;
  targetSpot?: number;
  expectedExitPrice?: number;
  exitMarkEst?: number;
  gainPct?: number;
  gainUsdPerContract?: number;
  moveDone?: boolean;
};

export type BestResultMonitorTicker = {
  symbol: string;
  name?: string | null;
  direction?: TradeDirection | null;
  baselineSpot?: number;
  spot?: number;
  movePct?: number;
  targetSpot?: number;
  expectedExitPrice?: number;
  stretchExitPrice?: number | null;
  /**
   * Ordered stock exit targets when Camino libre is not viable.
   * Last entry is the movement-profile estimate when present.
   */
  expectedExitPrices?: number[] | null;
  moveCapPct?: number;
  moveCapRemainingPct?: number;
  remainingMfePct?: number | null;
  exhaustionRisk?: boolean;
  movementProfile?: MovementProfile | null;
  pick?: BestResultStrikePick | null;
  estimate?: BestResultMoveEstimate | null;
  error?: string | null;
};

export type BestResultMonitorStatus = {
  monitorId?: string;
  status: string;
  runId?: string;
  moveCapPct?: number;
  polledAt?: string;
  tickers: BestResultMonitorTicker[];
  message?: string;
};
