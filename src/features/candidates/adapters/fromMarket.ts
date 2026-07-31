import type { TickerCardModel, TickerEvalResult, TickerStrategyEval } from "@/features/market/types";
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

export type MarketAdapterOptions = {
  updatedAt?: string;
  /** Optional tradability tier by symbol (excellent/strong/…). */
  tradabilityBySymbol?: Record<string, string | undefined>;
};

function leanFromEval(evalRow: TickerStrategyEval | null | undefined): MarketLeanView | null {
  if (!evalRow) return null;
  const direction = asDirection(evalRow.direction ?? null);
  const supportingSources: string[] = [];
  if (evalRow.directionEvidence) supportingSources.push(String(evalRow.directionEvidence));
  if (evalRow.directionSource) supportingSources.push(String(evalRow.directionSource));
  return {
    direction,
    confidence: confidenceFromDirection(evalRow.directionConfidence),
    agreement: null,
    supportingSources: supportingSources.slice(0, 3),
    conflicts: [],
    actionable: false,
  };
}

function adaptEval(args: {
  symbol: string;
  name?: string | null;
  evalRow: TickerStrategyEval;
  strategyName: string;
  updatedAt: string;
  tradabilityTier?: string;
}): CandidateViewModel {
  const { evalRow } = args;
  const qualityPct = Number(evalRow.qualityPct) || 0;
  const rules = evalRow.rules ?? [];
  const readiness = readinessFromRules(rules, qualityPct);
  const direction = asDirection(evalRow.direction ?? null);
  const tradability = tradabilityFromTier(args.tradabilityTier);
  const move = movementFields(null);
  const historicalEdge = null;
  const { rankScore, rankComponents } = buildRankComponents({
    qualityPct,
    historicalEdge,
    readiness,
    moveRemainingPct: move.moveRemainingPct,
    exhaustionRisk: move.exhaustionRisk,
    tradability,
    hasMovementProfile: false,
  });

  const dangerLabels = (evalRow.dangers ?? [])
    .filter((d) => d.status === "failed")
    .map((d) => d.evidence || d.dangerKey)
    .filter(Boolean) as string[];

  return {
    id: candidateId(args.symbol, evalRow.strategyId),
    symbol: args.symbol.toUpperCase(),
    name: args.name ?? null,
    direction,
    strategyId: evalRow.strategyId,
    strategyName: args.strategyName,
    readiness,
    qualityPct,
    historicalEdge,
    confidence: confidenceFromDirection(evalRow.directionConfidence),
    marketLean: leanFromEval(evalRow),
    ...move,
    tradability,
    updatedAt: args.updatedAt,
    supportingReasons: buildSupportingReasons(rules),
    conflictReasons: buildConflictReasons({
      rules,
      exhaustionRisk: false,
      dangerLabels,
    }),
    confirmationItems: buildConfirmationItems(rules),
    source: "market",
    movementProfile: null,
    rankScore,
    rankComponents,
  };
}

/**
 * Adapt a Market ticker card (best signal) into one CandidateViewModel.
 * Missing bestSignal → null (partial data).
 */
export function adaptMarketTickerCard(
  card: TickerCardModel,
  options: MarketAdapterOptions = {},
): CandidateViewModel | null {
  const best = card.bestSignal;
  const evalRow = card.topStrategyEval;
  if (!best && !evalRow) return null;

  const strategyId = best?.strategyId ?? evalRow?.strategyId;
  if (!strategyId) return null;

  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const qualityPct = best?.qualityPct ?? evalRow?.qualityPct ?? 0;
  const rules = evalRow?.rules ?? [];
  const readiness = readinessFromRules(rules, qualityPct);
  const direction = asDirection(best?.direction ?? evalRow?.direction ?? null);
  const profile = card.movementProfile ?? null;
  const move = movementFields(profile);
  const tradability = tradabilityFromTier(
    lookupSymbolMap(options.tradabilityBySymbol, card.symbol),
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

  const dangerLabels = (evalRow?.dangers ?? [])
    .filter((d) => d.status === "failed")
    .map((d) => d.evidence || d.dangerKey)
    .filter(Boolean) as string[];

  const strategyName = best?.strategyName || strategyId;

  return {
    id: candidateId(card.symbol, strategyId),
    symbol: card.symbol.toUpperCase(),
    name: card.name ?? null,
    direction,
    strategyId,
    strategyName,
    readiness,
    qualityPct,
    historicalEdge,
    confidence: confidenceFromDirection(evalRow?.directionConfidence),
    marketLean: leanFromEval(
      evalRow
        ? { ...evalRow, direction: evalRow.direction ?? best?.direction ?? null }
        : {
            strategyId,
            qualityPct,
            metCount: 0,
            totalCount: 0,
            metRequired: 0,
            totalRequired: 0,
            rules: [],
            direction: best?.direction ?? null,
          },
    ),
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
    source: "market",
    movementProfile: profile,
    rankScore,
    rankComponents,
  };
}

/** Adapt all ticker cards; drops rows with no usable signal. */
export function adaptMarketTickerCards(
  cards: TickerCardModel[],
  options: MarketAdapterOptions = {},
): CandidateViewModel[] {
  const out: CandidateViewModel[] = [];
  for (const card of cards) {
    const row = adaptMarketTickerCard(card, options);
    if (row) out.push(row);
  }
  return out;
}

/**
 * Adapt a full ticker eval result — one candidate per strategy eval,
 * or only the best when `bestOnly` is true.
 */
export function adaptMarketTickerResult(
  result: TickerEvalResult,
  options: MarketAdapterOptions & {
    strategyNameById?: Record<string, string>;
    bestOnly?: boolean;
  } = {},
): CandidateViewModel[] {
  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const strategies = [...(result.strategies ?? [])].sort(
    (a, b) => (b.qualityPct ?? 0) - (a.qualityPct ?? 0),
  );
  const selected = options.bestOnly ? strategies.slice(0, 1) : strategies;
  const profile = result.movementProfile ?? null;
  const out: CandidateViewModel[] = [];

  for (const evalRow of selected) {
    const base = adaptEval({
      symbol: result.symbol,
      name: result.name,
      evalRow,
      strategyName: options.strategyNameById?.[evalRow.strategyId] ?? evalRow.strategyId,
      updatedAt,
      tradabilityTier: lookupSymbolMap(options.tradabilityBySymbol, result.symbol),
    });
    const move = movementFields(profile);
    const historicalEdge = null;
    const { rankScore, rankComponents } = buildRankComponents({
      qualityPct: base.qualityPct,
      historicalEdge,
      readiness: base.readiness,
      moveRemainingPct: move.moveRemainingPct,
      exhaustionRisk: move.exhaustionRisk,
      tradability: base.tradability,
      hasMovementProfile: profile != null,
    });
    out.push({
      ...base,
      ...move,
      movementProfile: profile,
      conflictReasons: buildConflictReasons({
        rules: evalRow.rules,
        exhaustionRisk: move.exhaustionRisk,
        dangerLabels: (evalRow.dangers ?? [])
          .filter((d) => d.status === "failed")
          .map((d) => d.evidence || d.dangerKey)
          .filter(Boolean) as string[],
      }),
      rankScore,
      rankComponents,
    });
  }
  return out;
}
