import type { DynamicStrategy } from "../api/dynamic-strategy-client";

export function activeDynamicStrategies(strategies: DynamicStrategy[]): DynamicStrategy[] {
  return strategies.filter((row) => row.active !== false);
}

export function activeDynamicStrategyIds(strategies: DynamicStrategy[]): string[] {
  return activeDynamicStrategies(strategies)
    .map((row) => row.id)
    .filter(Boolean);
}

export function activeDynamicStrategyLabel(strategies: DynamicStrategy[]): string {
  const active = activeDynamicStrategies(strategies);
  if (active.length === 1) return active[0].name;
  if (active.length > 1) return `${active.length} dynamic strategies`;
  return "Dynamic strategies";
}

export function countActiveDynamicStrategies(strategies: DynamicStrategy[]): number {
  return activeDynamicStrategies(strategies).length;
}
