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
  orderRankScore,
  projectedOptionGainFromRoom,
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

function agreementCount(card: TickerCardModel, direction: string): number {
  const raw = card.directionAgreement;
  if (raw && raw.agreeingCount > 0) return raw.agreeingCount;
  const d = asDirection(direction);
  return d === "CALL" || d === "PUT" ? 1 : 0;
}

function adaptEval(args: {
  symbol: string;
  name?: string | null;
  evalRow: TickerStrategyEval;
  strategyName: string;
  updatedAt: string;
  tradabilityTier?: string;
  biasAgreementCount?: number;
}): CandidateViewModel {
  const { evalRow } = args;
  const qualityPct = Number(evalRow.qualityPct) || 0;
  const rules = evalRow.rules ?? [];
  const readiness = readinessFromRules(rules, qualityPct, {
    readiness: evalRow.readiness,
    preselectionNear: evalRow.preselectionNear,
    preselectionNearApplicable: evalRow.preselectionNearApplicable,
    lateEntry: evalRow.lateEntry,
    qualityInvalidated: evalRow.qualityInvalidated,
  });
  const direction = asDirection(evalRow.direction ?? null);
  const tradability = tradabilityFromTier(args.tradabilityTier);
  const move = movementFields(null);
  const historicalEdge = null;
  const biasAgreementCount = args.biasAgreementCount ?? (direction === "neutral" ? 0 : 1);
  const { rankComponents } = buildRankComponents({
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
    biasAgreementCount,
    ...move,
    projectedOptionGainPct: null,
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
    rankScore: orderRankScore({ readiness, biasAgreementCount, qualityPct }),
    rankComponents,
  };
}

/**
 * Adapt a Market ticker card into one CandidateViewModel from the top strategy
 * (highest qualityPct). Bias, quality, lean, and rules stay on that same eval.
 */
export function adaptMarketTickerCard(
  card: TickerCardModel,
  options: MarketAdapterOptions = {},
): CandidateViewModel | null {
  const evalRow = card.topStrategyEval;
  const best = card.bestSignal;
  if (!evalRow && !best) return null;

  const strategyId = evalRow?.strategyId ?? best?.strategyId;
  if (!strategyId) return null;

  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const qualityPct = evalRow?.qualityPct ?? best?.qualityPct ?? 0;
  const rules = evalRow?.rules ?? [];
  const readiness = readinessFromRules(rules, qualityPct, {
    readiness: evalRow?.readiness,
    preselectionNear: evalRow?.preselectionNear,
    preselectionNearApplicable: evalRow?.preselectionNearApplicable,
    lateEntry: evalRow?.lateEntry,
    qualityInvalidated: evalRow?.qualityInvalidated,
  });
  const direction = asDirection(evalRow?.direction ?? best?.direction ?? null);
  const profile = card.movementProfile ?? null;
  const move = movementFields(profile);
  const projectedOptionGainPct = projectedOptionGainFromRoom(card.optionRoom);
  const tradability = tradabilityFromTier(
    lookupSymbolMap(options.tradabilityBySymbol, card.symbol),
  );
  const historicalEdge = null;
  const biasAgreementCount = agreementCount(card, direction);
  const { rankComponents } = buildRankComponents({
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

  const sameBest = best && best.strategyId === strategyId;
  const strategyName =
    evalRow?.strategyName || (sameBest ? best?.strategyName : null) || strategyId;

  const leanEval: TickerStrategyEval = evalRow
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
      };

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
    marketLean: leanFromEval(leanEval),
    biasAgreementCount,
    ...move,
    projectedOptionGainPct,
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
    rankScore: orderRankScore({ readiness, biasAgreementCount, qualityPct }),
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

  const topDir = asDirection(strategies[0]?.direction ?? null);
  const directional = strategies.filter((s) => {
    const d = asDirection(s.direction ?? null);
    return d === "CALL" || d === "PUT";
  });
  const agreeing =
    topDir === "CALL" || topDir === "PUT"
      ? directional.filter((s) => asDirection(s.direction ?? null) === topDir).length
      : 0;

  for (const evalRow of selected) {
    const isTop = evalRow === strategies[0] || options.bestOnly;
    const base = adaptEval({
      symbol: result.symbol,
      name: result.name,
      evalRow,
      strategyName: options.strategyNameById?.[evalRow.strategyId] ?? evalRow.strategyId,
      updatedAt,
      tradabilityTier: lookupSymbolMap(options.tradabilityBySymbol, result.symbol),
      biasAgreementCount: isTop ? agreeing || 1 : 1,
    });
    const move = movementFields(profile);
    const historicalEdge = null;
    const { rankComponents } = buildRankComponents({
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
      rankScore: orderRankScore({
        readiness: base.readiness,
        biasAgreementCount: base.biasAgreementCount,
        qualityPct: base.qualityPct,
      }),
      rankComponents,
    });
  }
  return out;
}
