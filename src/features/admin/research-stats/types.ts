/** Research evaluates either a named strategy OR a named rule set — never both. */

export type ResearchScopeMode = "strategy" | "rules";

export type ResearchTimeframe = "15m" | "1h" | "D";

export type ResearchMovementDirection = "up" | "down";

/** One rule in a rules-mode research (trend/operation when catalog requires them). */
export type ResearchRuleSelection = {
  ruleKey: string;
  label?: string;
  timeframe?: string;
  trend?: "up" | "down" | "lateral";
  operation?: "call" | "put";
  /**
   * Which movement direction this rule is studied against.
   * Defaults from trend when trend is up/down.
   */
  movement: ResearchMovementDirection;
};

export type ResearchStatsRequest = {
  /** Human name for this research config (e.g. "E01 open drive"). */
  name: string;
  symbol: string;
  startDate: string;
  endDate: string;
  /** Single timeframe for bars + rule eval. */
  timeframe: ResearchTimeframe;
  mode: ResearchScopeMode;
  /** mode=strategy — use catalog strategy definition as-is. */
  strategyId?: string;
  /** mode=rules — explicit rule rows with optional trend/operation. */
  rules?: ResearchRuleSelection[];
};

export type RuleHourStat = {
  hourEt: number;
  ruleKey: string;
  movement: ResearchMovementDirection;
  trueCount: number;
  evalCount: number;
  trueRatePct: number;
};

export type StrategyHourStat = {
  hourEt: number;
  strategyId: string;
  trueCount: number;
  evalCount: number;
  trueRatePct: number;
};

/** Price movement labeled only UP or DOWN, with matched predictor rules (or strategy). */
export type IdentifiedMovement = {
  atEt: string;
  direction: ResearchMovementDirection;
  hourEt: number;
  /** Rules true at the checkpoint that were tagged for this direction. */
  matchedRuleKeys: string[];
  /** Strategy mode: true when strategy fired at this checkpoint (existing eval). */
  strategyTrue?: boolean;
};

export type DirectionRuleCommonality = {
  direction: ResearchMovementDirection;
  movementsTotal: number;
  rules: {
    ruleKey: string;
    movementsWithRule: number;
    sharePct: number;
  }[];
};

export type ResearchStatsResult = {
  runId: string;
  status: "complete" | "failed";
  message: string;
  /** Server overwrites the single stored research result on each run. */
  overwritten: boolean;
  request: ResearchStatsRequest;
  summary: {
    sessionsEvaluated: number;
    /** Rules mode: total rule-true hits. Strategy mode: null. */
    rulesTrueTotal: number | null;
    /** Strategy mode: how often strategy evaluated true (catalog definition). */
    strategyTrueTotal: number | null;
    movementsUp: number;
    movementsDown: number;
  };
  byHour: {
    rules: RuleHourStat[];
    strategy: StrategyHourStat[];
  };
  movements: IdentifiedMovement[];
  /** Rule ↔ UP/DOWN commonality (rules mode). Empty for strategy-only. */
  movementCommonality: DirectionRuleCommonality[];
  savedTo?: string | null;
};
