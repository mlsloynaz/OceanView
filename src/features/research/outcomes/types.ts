export type LearningOutcomeStatus = "pending" | "complete" | "skipped";

export type LearningHorizonResult = {
  horizonId?: string;
  timeframe?: string;
  bars?: number;
  barsAvailable?: number;
  complete?: boolean;
  entryPrice?: number | null;
  targetPct?: number | null;
  stopPct?: number | null;
  maxFavorableExcursionPct?: number | null;
  maxAdverseExcursionPct?: number | null;
  directionCorrect?: boolean | null;
  targetReached?: boolean;
  stopReached?: boolean;
  targetBeforeStop?: boolean;
  barsToTarget?: number | null;
  barsToStop?: number | null;
};

export type LearningObservation = {
  observationId: string;
  runId?: string;
  symbol: string;
  observedAt: string;
  dataThrough?: string;
  tradeDate?: string;
  source?: string;
  strategyId?: string;
  strategyVersion?: string;
  catalogVersion?: string;
  direction?: string;
  qualityPct?: number;
  marketLean?: string | null;
  ruleResults?: unknown[];
  foundationSnapshot?: Record<string, unknown>;
  movementProfileSnapshot?: Record<string, unknown>;
  tradabilitySnapshot?: Record<string, unknown>;
  featureSchemaVersion?: string;
  outcomeStatus?: LearningOutcomeStatus | string;
  outcomeCompletedAt?: string | null;
  learningUniverse?: boolean;
};

export type LearningOutcome = {
  observationId: string;
  status?: string;
  reason?: string;
  completedAt?: string;
  symbol?: string;
  direction?: string;
  observedAt?: string;
  horizons?: LearningHorizonResult[];
  primaryHorizonId?: string | null;
  maxFavorableExcursionPct?: number | null;
  maxAdverseExcursionPct?: number | null;
  targetReached?: boolean | null;
  stopReached?: boolean | null;
  targetBeforeStop?: boolean | null;
  barsToTarget?: number | null;
  directionCorrect?: boolean | null;
};

export type LearningObservationsListResponse = {
  outcomeStatus: string;
  count: number;
  observations: LearningObservation[];
};

export type LearningOutcomesRunResponse = {
  status: string;
  message?: string;
  limit?: number;
  summary?: {
    scanned?: number;
    completed?: number;
    stillPending?: number;
    skipped?: number;
    errors?: number;
  };
  results?: Array<{ observationId?: string; status?: string; reason?: string }>;
};

export type LearningJobSummary = {
  status: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  summary?: LearningOutcomesRunResponse["summary"];
};
