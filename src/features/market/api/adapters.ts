import type {
  RuleCardModel,
  RuleSnapshotItem,
  StrategyCardModel,
  StrategyCatalogItem,
  StrategySnapshotItem,
  TickerCardModel,
  TickerSnapshotItem,
} from "../types";
import { activeCatalogStrategies } from "../lib/catalog";

export function adaptStrategySnapshotItems(
  catalog: StrategyCatalogItem[],
  items: StrategySnapshotItem[],
): StrategyCardModel[] {
  const byId = new Map(items.map((item) => [item.strategyId, item]));

  return activeCatalogStrategies(catalog).map((strategy) => {
    const item = byId.get(strategy.id);
    return {
      strategy,
      signalCount: item?.signalCount ?? 0,
      previewTickers: item?.previewTickers ?? [],
    };
  });
}

export function adaptTickerSnapshotItems(items: TickerSnapshotItem[]): TickerCardModel[] {
  return items.map((item) => {
    const top = item.topStrategyEval;
    return {
      symbol: item.symbol,
      name: item.name,
      signalCount: item.signalCount,
      bestSignal: item.bestSignal,
      topStrategyEval: top
        ? {
            strategyId: top.strategyId,
            qualityPct: top.qualityPct,
            direction: top.direction ?? null,
            directionConfidence: top.directionConfidence ?? null,
            readiness: top.readiness ?? null,
            lateEntry: top.lateEntry ?? null,
            qualityInvalidated: top.qualityInvalidated ?? undefined,
            metCount: top.metRequired ?? 0,
            totalCount: top.totalRequired ?? 0,
            metRequired: top.metRequired ?? 0,
            totalRequired: top.totalRequired ?? 0,
            preselectionNear: top.preselectionNear ?? null,
            preselectionNearApplicable: top.preselectionNearApplicable ?? null,
            rules: top.rules,
            dangers: top.dangers,
            ...(top.strategyName ? { strategyName: top.strategyName } : {}),
          }
        : null,
      directionAgreement: item.directionAgreement ?? null,
      strategyFits: item.strategyFits ?? undefined,
      movementProfile: item.movementProfile ?? null,
      optionRoom: item.optionRoom ?? null,
    };
  });
}

export function adaptRuleSnapshotItems(items: RuleSnapshotItem[]): RuleCardModel[] {
  return items;
}
