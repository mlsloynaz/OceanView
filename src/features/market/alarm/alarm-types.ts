import type { PollIntervalUnit } from "@/shared/components/PollControls";

/** Rules that can be used in Market Alarm watches. */
export const ALARM_ELIGIBLE_RULES = [
  {
    ruleKey: "confirmation_change_trend_1h",
    label: "Confirmation change-trend (1h)",
  },
  {
    ruleKey: "confirmation_change_trend_15m",
    label: "Confirmation change-trend (15m)",
  },
  {
    ruleKey: "touch_disipador",
    label: "Disipador touch (candle + BB)",
  },
  {
    ruleKey: "breakout_quality",
    label: "Breakout quality (15M multi-TF)",
  },
] as const;

export type AlarmEligibleRuleKey = (typeof ALARM_ELIGIBLE_RULES)[number]["ruleKey"];

/** Same TF for candle + Bollinger (touch_disipador). */
export type AlarmBandTimeframe = "1m" | "15m" | "1h";

/** ``auto`` = both directions (breakout_quality alone only). */
export type AlarmTrend = "alcista" | "bajista" | "auto";

export type AlarmWatchStatus =
  | "idle"
  | "running"
  | "checking"
  | "paused"
  | "met"
  | "in_trade"
  | "exit"
  | "stopped"
  | "error";

export type AlarmPopupKind = "enter" | "exit";

/** Compact 15m OHLC + Bollinger series for the Breakout board chart panel. */
export type BbSparkline15mBar = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  bbUpper: number | null;
  bbMid: number | null;
  bbLower: number | null;
  forming?: boolean;
};

export type BbSparkline15m = {
  symbol: string;
  timeframe: "15m";
  bbPeriod: number;
  bars: BbSparkline15mBar[];
};

export type MarketAlarmWatch = {
  id: string;
  symbol: string;
  /** Primary rule (first selected) — kept for display / legacy. */
  ruleKey: AlarmEligibleRuleKey;
  /** All criteria evaluated together (AND). */
  ruleKeys: AlarmEligibleRuleKey[];
  ruleLabel: string;
  trend: AlarmTrend;
  /** Used by touch_disipador — candle + BB timeframe (same TF). */
  bandTimeframe?: AlarmBandTimeframe;
  frequencyValue: number;
  frequencyUnit: PollIntervalUnit;
  status: AlarmWatchStatus;
  lastRuleStatus: string | null;
  lastEvidence: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  metAt: string | null;
  enteredAt?: string | null;
  exitedAt?: string | null;
  exitEvidence?: string | null;
  lastBreakoutScore?: number | null;
  lastContinuationScore?: number | null;
  lastLifecycle?: string | null;
  lastBreakoutType?: string | null;
  lastSetupType?: string | null;
  /** Last 15m BB sparkline from breakout alarm check (≤9 bars). */
  lastBbSparkline15m?: BbSparkline15m | null;
  lastBreakoutLevel?: number | null;
  /** Breakout watches default to entry_ready (alert only on Entry). */
  alarmTarget?: "confirmed" | "entry_ready";
  lastDetectedTrend?: AlarmTrend | null;
  /** Per-rule status from last combined check. */
  lastRuleResults?: { ruleKey: string; status: string; met?: boolean; evidence?: string | null }[] | null;
};

export function alarmRuleLabel(ruleKey: string): string {
  return ALARM_ELIGIBLE_RULES.find((r) => r.ruleKey === ruleKey)?.label ?? ruleKey;
}

export function alarmRulesLabel(ruleKeys: string[]): string {
  if (ruleKeys.length === 0) return "";
  if (ruleKeys.length === 1) return alarmRuleLabel(ruleKeys[0]!);
  return ruleKeys.map(alarmRuleLabel).join(" + ");
}

export function formatAlarmTrend(trend: AlarmTrend): string {
  if (trend === "auto") return "Auto (alcista/bajista)";
  return trend === "alcista" ? "Alcista" : "Bajista";
}

export function needsBandTimeframe(ruleKeys: string | string[]): boolean {
  const keys = Array.isArray(ruleKeys) ? ruleKeys : [ruleKeys];
  return keys.includes("touch_disipador");
}

/** Trend picker when any selected rule is not breakout-only auto. */
export function needsTrendPicker(ruleKeys: string | string[]): boolean {
  const keys = Array.isArray(ruleKeys) ? ruleKeys : [ruleKeys];
  if (keys.length === 0) return true;
  if (keys.length === 1 && keys[0] === "breakout_quality") return false;
  return true;
}
