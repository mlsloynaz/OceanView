import type {
  CandidateDirection,
  CandidateRankComponents,
  CandidateReadiness,
  ConfidenceLevel,
  ConfirmationItem,
  TradabilityGrade,
} from "../models/CandidateViewModel";
import type { MovementProfile } from "@/features/premarket/types";

export function asDirection(
  value: string | null | undefined,
): CandidateDirection {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  if (raw === "CALL" || raw === "PUT") return raw;
  return "neutral";
}

export function readinessLabel(readiness: CandidateReadiness): string {
  switch (readiness) {
    case "preparing":
      return "Preparing";
    case "watching":
      return "Watching";
    case "near":
      return "Near";
    case "confirmed":
      return "Confirmed";
    case "weakening":
      return "Weakening";
    case "invalid":
      return "Invalid";
    case "expired":
      return "Expired";
    case "error":
      return "Error";
    default:
      return readiness;
  }
}

export function tradabilityLabel(grade: TradabilityGrade): string {
  switch (grade) {
    case "good":
      return "Good";
    case "fair":
      return "Fair";
    case "poor":
      return "Poor";
    default:
      return "Unknown";
  }
}

export function directionLabel(direction: CandidateDirection): string {
  if (direction === "neutral") return "Neutral";
  return direction;
}

/** Map backend rule status → confirmation item status. */
export function confirmationStatusFromRule(
  status: string | null | undefined,
): ConfirmationItem["status"] {
  const s = String(status ?? "")
    .trim()
    .toLowerCase();
  if (s === "met") return "met";
  if (s === "partial" || s === "about_to_cross") return "near";
  return "pending";
}

type RuleLike = {
  label?: string | null;
  ruleKey?: string | null;
  status?: string | null;
  type?: string | null;
  evidence?: string | null;
};

function normalizeRuleStatus(status: string | null | undefined): string {
  return String(status ?? "")
    .trim()
    .toLowerCase();
}

function isExtraRule(type: string | null | undefined): boolean {
  const t = String(type ?? "")
    .trim()
    .toLowerCase();
  return t === "extra" || t === "bonus" || t === "optional";
}

/**
 * Derive readiness from rule results + quality.
 * Does not invent Watching without an active watch session — adapters may override.
 */
export function readinessFromRules(
  rules: RuleLike[] | null | undefined,
  qualityPct: number,
): CandidateReadiness {
  const list = Array.isArray(rules) ? rules : [];
  if (list.length === 0) {
    if (qualityPct >= 100) return "confirmed";
    if (qualityPct >= 60) return "near";
    return "preparing";
  }

  const core = list.filter((r) => !isExtraRule(r.type));
  const focus = core.length > 0 ? core : list;
  let met = 0;
  let near = 0;
  let failed = 0;
  for (const rule of focus) {
    const s = normalizeRuleStatus(rule.status);
    if (s === "met") met += 1;
    else if (s === "partial" || s === "about_to_cross") near += 1;
    else if (s === "not_met") failed += 1;
  }

  if (met === focus.length && focus.length > 0) return "confirmed";
  if (qualityPct >= 100 && near === 0 && failed === 0) return "confirmed";
  if (met > 0 || near > 0) return "near";
  if (failed === focus.length && qualityPct < 40) return "preparing";
  return "preparing";
}

export function buildConfirmationItems(rules: RuleLike[] | null | undefined): ConfirmationItem[] {
  const list = Array.isArray(rules) ? rules : [];
  return list.slice(0, 8).map((rule) => ({
    label: String(rule.label || rule.ruleKey || "Rule").trim() || "Rule",
    status: confirmationStatusFromRule(rule.status),
  }));
}

export function buildSupportingReasons(rules: RuleLike[] | null | undefined, limit = 3): string[] {
  const list = Array.isArray(rules) ? rules : [];
  const met = list.filter((r) => normalizeRuleStatus(r.status) === "met");
  return met
    .map((r) => {
      const evidence = String(r.evidence ?? "").trim();
      if (evidence) return evidence;
      return String(r.label || r.ruleKey || "").trim();
    })
    .filter(Boolean)
    .slice(0, limit);
}

export function buildConflictReasons(args: {
  rules?: RuleLike[] | null;
  exhaustionRisk?: boolean;
  dangerLabels?: string[];
  limit?: number;
}): string[] {
  const limit = args.limit ?? 3;
  const out: string[] = [];
  if (args.exhaustionRisk) out.push("Exhaustion risk elevated");
  for (const label of args.dangerLabels ?? []) {
    if (label) out.push(label);
    if (out.length >= limit) return out.slice(0, limit);
  }
  const rules = Array.isArray(args.rules) ? args.rules : [];
  for (const rule of rules) {
    if (isExtraRule(rule.type)) continue;
    if (normalizeRuleStatus(rule.status) !== "not_met") continue;
    const label = String(rule.label || rule.ruleKey || "").trim();
    if (label) out.push(label);
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}

export function movementFields(profile: MovementProfile | null | undefined) {
  return {
    moveRemainingPct:
      typeof profile?.moveCapRemainingPct === "number"
        ? profile.moveCapRemainingPct
        : typeof profile?.remainingMfePct === "number"
          ? profile.remainingMfePct
          : null,
    expectedMovePct:
      typeof profile?.expectedMfePct === "number" ? profile.expectedMfePct : null,
    stretchMovePct:
      typeof profile?.stretchMoveCapPct === "number"
        ? profile.stretchMoveCapPct
        : typeof profile?.p90MfePct === "number"
          ? profile.p90MfePct
          : null,
    expectedMaePct:
      typeof profile?.expectedMaePct === "number" ? profile.expectedMaePct : null,
    timeToTargetBars:
      typeof profile?.timeToTargetBars === "number" ? profile.timeToTargetBars : null,
    exhaustionRisk: Boolean(profile?.exhaustionRisk),
  };
}

/** Map tradability / best-fit tier strings into Good / Fair / Poor. */
export function tradabilityFromTier(tier: string | null | undefined): TradabilityGrade {
  const t = String(tier ?? "")
    .trim()
    .toLowerCase();
  if (!t) return "unknown";
  if (t === "excellent" || t === "strong" || t === "good") return "good";
  if (t === "moderate" || t === "fair") return "fair";
  if (t === "watch" || t === "skip" || t === "poor") return "poor";
  return "unknown";
}

export function confidenceFromDirection(
  value: string | null | undefined,
): ConfidenceLevel | null {
  const c = String(value ?? "")
    .trim()
    .toLowerCase();
  if (c === "high" || c === "medium" || c === "low") return c;
  return null;
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function readinessScore(readiness: CandidateReadiness): number {
  switch (readiness) {
    case "confirmed":
      return 100;
    case "watching":
      return 80;
    case "near":
      return 70;
    case "preparing":
      return 35;
    case "weakening":
      return 25;
    case "invalid":
    case "expired":
    case "error":
      return 0;
    default:
      return 40;
  }
}

function tradabilityScore(grade: TradabilityGrade): number {
  switch (grade) {
    case "good":
      return 84;
    case "fair":
      return 60;
    case "poor":
      return 30;
    default:
      return 50;
  }
}

function movementRoomScore(moveRemainingPct: number | null, exhaustionRisk: boolean): number {
  if (exhaustionRisk) return 20;
  if (moveRemainingPct == null) return 50;
  // Treat ~1% remaining as strong room; scale gently.
  return clampPct(moveRemainingPct * 80);
}

/**
 * Build rank components. Historical edge contributes 0 when unknown —
 * do not invent a probability from qualityPct.
 */
export function buildRankComponents(input: {
  qualityPct: number;
  historicalEdge: number | null;
  readiness: CandidateReadiness;
  moveRemainingPct: number | null;
  exhaustionRisk: boolean;
  tradability: TradabilityGrade;
  hasMovementProfile: boolean;
}): { rankScore: number; rankComponents: CandidateRankComponents } {
  const setupQuality = clampPct(input.qualityPct);
  const historicalEdge =
    input.historicalEdge == null ? 0 : clampPct(input.historicalEdge);
  const readiness = readinessScore(input.readiness);
  const movementRoom = movementRoomScore(input.moveRemainingPct, input.exhaustionRisk);
  const tradability = tradabilityScore(input.tradability);
  const dataQuality = input.hasMovementProfile ? 100 : 70;

  const rankComponents: CandidateRankComponents = {
    setupQuality,
    historicalEdge,
    readiness,
    movementRoom,
    tradability,
    dataQuality,
  };

  // When historical edge is unknown, redistribute weight across known dimensions.
  const hasEdge = input.historicalEdge != null;
  const rankScore = hasEdge
    ? clampPct(
        setupQuality * 0.3 +
          historicalEdge * 0.25 +
          readiness * 0.2 +
          movementRoom * 0.1 +
          tradability * 0.1 +
          dataQuality * 0.05,
      )
    : clampPct(
        setupQuality * 0.4 +
          readiness * 0.25 +
          movementRoom * 0.15 +
          tradability * 0.12 +
          dataQuality * 0.08,
      );

  return { rankScore, rankComponents };
}

export function candidateId(symbol: string, strategyId: string): string {
  return `${symbol.toUpperCase()}#${strategyId}`;
}

export function lookupSymbolMap(
  map: Record<string, string | undefined> | undefined,
  symbol: string,
): string | undefined {
  if (!map) return undefined;
  if (symbol in map) return map[symbol];
  const upper = symbol.toUpperCase();
  if (upper in map) return map[upper];
  const found = Object.entries(map).find(([key]) => key.toUpperCase() === upper);
  return found?.[1];
}

export function sortCandidatesByRank<T extends { rankScore: number; qualityPct: number; symbol: string }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
    if (b.qualityPct !== a.qualityPct) return b.qualityPct - a.qualityPct;
    return a.symbol.localeCompare(b.symbol);
  });
}
