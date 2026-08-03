import type { MovementProfile } from "@/features/premarket/types";

/** User-facing trade direction (includes neutral). */
export type CandidateDirection = "CALL" | "PUT" | "neutral";

/**
 * Shared candidate readiness vocabulary.
 * Derived from rule statuses — not raw backend `met` / `not_met` strings.
 */
export type CandidateReadiness =
  | "preparing"
  | "watching"
  | "near"
  | "confirmed"
  | "late"
  | "weakening"
  | "invalid"
  | "expired"
  | "error";

export type TradabilityGrade = "good" | "fair" | "poor" | "unknown";

export type ConfidenceLevel = "low" | "medium" | "high";

export type CandidateSource = "market" | "premarket";

/** Informational lean only — never drives entries. */
export type MarketLeanView = {
  direction: CandidateDirection;
  confidence?: ConfidenceLevel | null;
  agreement?: number | null;
  supportingSources: string[];
  conflicts: string[];
  /** Always false until product explicitly allows otherwise. */
  actionable: false;
};

export type ConfirmationItem = {
  label: string;
  status: "met" | "near" | "pending";
};

/** Ranking components kept separate — never labeled probability. */
export type CandidateRankComponents = {
  setupQuality: number;
  /** 0 when historical edge is unknown (do not invent). */
  historicalEdge: number;
  readiness: number;
  movementRoom: number;
  tradability: number;
  dataQuality: number;
};

/**
 * Normalized UI shape for Today Top Candidates.
 * Quality and historical edge stay separate fields.
 */
export type CandidateViewModel = {
  id: string;
  symbol: string;
  name?: string | null;
  direction: CandidateDirection;
  strategyId: string;
  strategyName: string;
  readiness: CandidateReadiness;
  /** Setup completeness vs strategy rules — not win probability. */
  qualityPct: number;
  /** Observed target-first rate when available; null until learning outcomes exist. */
  historicalEdge: number | null;
  confidence: ConfidenceLevel | null;
  marketLean: MarketLeanView | null;
  /** Active strategies agreeing on this row's CALL/PUT (1 = only this strategy). */
  biasAgreementCount: number;
  moveRemainingPct: number | null;
  expectedMovePct: number | null;
  stretchMovePct: number | null;
  expectedMaePct: number | null;
  timeToTargetBars: number | null;
  exhaustionRisk: boolean;
  tradability: TradabilityGrade;
  updatedAt: string;
  supportingReasons: string[];
  conflictReasons: string[];
  confirmationItems: ConfirmationItem[];
  source: CandidateSource;
  movementProfile: MovementProfile | null;
  /** Sort key for drawer display only — not probability. */
  rankScore: number;
  rankComponents: CandidateRankComponents;
};
