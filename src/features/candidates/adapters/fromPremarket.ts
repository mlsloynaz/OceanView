import type {
  PremarketBestHit,
  PremarketBestResultRow,
  PremarketTickerHit,
} from "@/features/premarket/types";
import type { CandidateViewModel, MarketLeanView } from "../models/CandidateViewModel";
import {
  asDirection,
  buildConfirmationItems,
  buildConflictReasons,
  buildRankComponents,
  buildSupportingReasons,
  candidateId,
  confidenceFromDirection,
  lookupSymbolMap,
  movementFields,
  readinessFromRules,
  tradabilityFromTier,
} from "../lib/normalize";

export type PremarketAdapterOptions = {
  updatedAt?: string;
  tradabilityBySymbol?: Record<string, string | undefined>;
};

function leanFromHit(args: {
  direction: ReturnType<typeof asDirection>;
  confidence?: string | null;
  evidence?: string | null;
  source?: string | null;
}): MarketLeanView {
  const supportingSources: string[] = [];
  if (args.evidence) supportingSources.push(args.evidence);
  if (args.source) supportingSources.push(args.source);
  return {
    direction: args.direction,
    confidence: confidenceFromDirection(args.confidence),
    agreement: null,
    supportingSources: supportingSources.slice(0, 3),
    conflicts: [],
    actionable: false,
  };
}

/**
 * Adapt a Premarket best-result hit (Top Candidates source for Preparation).
 */
export function adaptPremarketBestHit(
  hit: PremarketBestHit | PremarketBestResultRow,
  options: PremarketAdapterOptions = {},
): CandidateViewModel {
  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const bestTicker = "bestTicker" in hit ? hit.bestTicker : undefined;
  const bestGroup = "bestGroup" in hit ? hit.bestGroup : undefined;

  const topStrategy = hit.strategies?.[0];
  const strategyId = topStrategy?.strategyId || bestGroup?.strategyId || "unknown";
  const strategyName =
    topStrategy?.label ||
    bestGroup?.shortName ||
    bestGroup?.name ||
    strategyId;

  const rules = bestTicker?.rules ?? [];
  const qualityPct = Number(hit.qualityPct) || Number(bestTicker?.qualityPct) || 0;
  const readiness = readinessFromRules(rules, qualityPct, {
    readiness: bestTicker?.readiness,
    preselectionNear: bestTicker?.preselectionNear,
    preselectionNearApplicable: bestTicker?.preselectionNearApplicable,
  });
  const direction = asDirection(hit.direction ?? bestTicker?.direction ?? null);
  const profile = hit.movementProfile ?? bestTicker?.movementProfile ?? null;
  const move = movementFields(profile);
  const tradability = tradabilityFromTier(
    lookupSymbolMap(options.tradabilityBySymbol, hit.symbol),
  );
  const historicalEdge = null;
  const { rankScore, rankComponents } = buildRankComponents({
    qualityPct,
    historicalEdge,
    readiness,
    moveRemainingPct: move.moveRemainingPct,
    exhaustionRisk: move.exhaustionRisk,
    tradability,
    hasMovementProfile: profile != null,
  });

  const dangerLabels = (bestTicker?.dangers ?? [])
    .filter((d) => d.status === "failed")
    .map((d) => d.evidence || d.dangerKey)
    .filter(Boolean) as string[];

  return {
    id: candidateId(hit.symbol, strategyId),
    symbol: String(hit.symbol).toUpperCase(),
    name: hit.name ?? bestTicker?.name ?? null,
    direction,
    strategyId,
    strategyName,
    readiness,
    qualityPct,
    historicalEdge,
    confidence: confidenceFromDirection(bestTicker?.directionConfidence),
    marketLean: leanFromHit({
      direction,
      confidence: bestTicker?.directionConfidence,
      evidence: bestTicker?.directionEvidence,
      source: bestTicker?.directionSource,
    }),
    ...move,
    tradability,
    updatedAt,
    supportingReasons: buildSupportingReasons(rules),
    conflictReasons: buildConflictReasons({
      rules,
      exhaustionRisk: move.exhaustionRisk,
      dangerLabels,
    }),
    confirmationItems: buildConfirmationItems(rules),
    source: "premarket",
    movementProfile: profile,
    rankScore,
    rankComponents,
  };
}

export function adaptPremarketBestHits(
  hits: Array<PremarketBestHit | PremarketBestResultRow>,
  options: PremarketAdapterOptions = {},
): CandidateViewModel[] {
  return hits.map((hit) => adaptPremarketBestHit(hit, options));
}

/**
 * Adapt a single Premarket ticker hit under a known strategy group.
 */
export function adaptPremarketTickerHit(
  hit: PremarketTickerHit,
  strategy: { strategyId: string; name?: string | null; shortName?: string | null },
  options: PremarketAdapterOptions = {},
): CandidateViewModel {
  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const qualityPct = Number(hit.qualityPct) || 0;
  const rules = hit.rules ?? [];
  const readiness = readinessFromRules(rules, qualityPct, {
    readiness: hit.readiness,
    preselectionNear: hit.preselectionNear,
    preselectionNearApplicable: hit.preselectionNearApplicable,
  });
  const direction = asDirection(hit.direction ?? null);
  const profile = hit.movementProfile ?? null;
  const move = movementFields(profile);
  const tradability = tradabilityFromTier(
    lookupSymbolMap(options.tradabilityBySymbol, hit.symbol),
  );
  const historicalEdge = null;
  const { rankScore, rankComponents } = buildRankComponents({
    qualityPct,
    historicalEdge,
    readiness,
    moveRemainingPct: move.moveRemainingPct,
    exhaustionRisk: move.exhaustionRisk,
    tradability,
    hasMovementProfile: profile != null,
  });

  const strategyName = strategy.shortName || strategy.name || strategy.strategyId;
  const dangerLabels = (hit.dangers ?? [])
    .filter((d) => d.status === "failed")
    .map((d) => d.evidence || d.dangerKey)
    .filter(Boolean) as string[];

  return {
    id: candidateId(hit.symbol, strategy.strategyId),
    symbol: String(hit.symbol).toUpperCase(),
    name: hit.name ?? null,
    direction,
    strategyId: strategy.strategyId,
    strategyName,
    readiness,
    qualityPct,
    historicalEdge,
    confidence: confidenceFromDirection(hit.directionConfidence),
    marketLean: leanFromHit({
      direction,
      confidence: hit.directionConfidence,
      evidence: hit.directionEvidence,
      source: hit.directionSource,
    }),
    ...move,
    tradability,
    updatedAt,
    supportingReasons: buildSupportingReasons(rules),
    conflictReasons: buildConflictReasons({
      rules,
      exhaustionRisk: move.exhaustionRisk,
      dangerLabels,
    }),
    confirmationItems: buildConfirmationItems(rules),
    source: "premarket",
    movementProfile: profile,
    rankScore,
    rankComponents,
  };
}
