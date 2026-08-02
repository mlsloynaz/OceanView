import type { DynamicStrategy } from "../api/dynamic-strategy-client";

/**
 * Active strategies eligible for Today Preparation / Premarket evaluate.
 * One unified catalog — any active row (tier is legacy metadata only).
 */
export function activePremarketStrategies(strategies: DynamicStrategy[]): DynamicStrategy[] {
  return strategies.filter((row) => row.active !== false);
}

/** @deprecated Use activePremarketStrategies */
export const activeDynamicStrategies = activePremarketStrategies;

export function activePremarketStrategyIds(strategies: DynamicStrategy[]): string[] {
  return activePremarketStrategies(strategies)
    .map((row) => row.id)
    .filter(Boolean);
}

/** @deprecated Use activePremarketStrategyIds */
export const activeDynamicStrategyIds = activePremarketStrategyIds;

export function activePremarketStrategyLabel(strategies: DynamicStrategy[]): string {
  const active = activePremarketStrategies(strategies);
  if (active.length === 1) return active[0].name;
  if (active.length > 1) return `${active.length} strategies`;
  return "Strategies";
}

/** @deprecated Use activePremarketStrategyLabel */
export const activeDynamicStrategyLabel = activePremarketStrategyLabel;

export function countActivePremarketStrategies(strategies: DynamicStrategy[]): number {
  return activePremarketStrategies(strategies).length;
}

/** @deprecated Use countActivePremarketStrategies */
export const countActiveDynamicStrategies = countActivePremarketStrategies;
