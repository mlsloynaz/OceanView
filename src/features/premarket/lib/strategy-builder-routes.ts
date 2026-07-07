export const STRATEGY_BUILDER_NEW_PATH = "/strategies/new";

export function strategyBuilderEditPath(strategyId: string): string {
  return `/strategies/${encodeURIComponent(strategyId)}/edit`;
}

export type StrategyBuilderLocationState = {
  returnTo?: string;
};

export const DEFAULT_STRATEGY_BUILDER_RETURN = "/admin#admin-strategies-pane";
