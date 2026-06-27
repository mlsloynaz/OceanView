import type { StrategiesCatalogFile, StrategyCatalogItem } from "../types";

/** Matches API `is_strategy_active`: only explicit `active: true` counts. */
export function isStrategyActive(strategy: StrategyCatalogItem): boolean {
  return strategy.active === true;
}

export function activeCatalogStrategies(
  catalog: StrategyCatalogItem[] | undefined,
): StrategyCatalogItem[] {
  return (catalog ?? []).filter(isStrategyActive);
}

export function countActiveRules(catalog: StrategiesCatalogFile | null): number {
  return activeCatalogStrategies(catalog?.strategies).reduce(
    (sum, strategy) => sum + strategy.rules.length,
    0,
  );
}

export function countActiveStrategies(catalog: StrategiesCatalogFile | null): number {
  return activeCatalogStrategies(catalog?.strategies).length;
}
