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
  return items.map((item) => ({
    symbol: item.symbol,
    name: item.name,
    signalCount: item.signalCount,
    bestSignal: item.bestSignal,
    topStrategyEval: item.topStrategyEval
      ? {
          strategyId: item.topStrategyEval.strategyId,
          qualityPct: item.topStrategyEval.qualityPct,
          direction: item.bestSignal?.direction ?? null,
          metCount: 0,
          totalCount: 0,
          metRequired: 0,
          totalRequired: 0,
          rules: item.topStrategyEval.rules,
        }
      : null,
    movementProfile: item.movementProfile ?? null,
  }));
}

export function adaptRuleSnapshotItems(items: RuleSnapshotItem[]): RuleCardModel[] {
  return items;
}
