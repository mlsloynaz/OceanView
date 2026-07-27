import type { PollIntervalUnit } from "@/shared/components/PollControls";

/** Rules that can be used in Market Alarm watches. */
export const ALARM_ELIGIBLE_RULES = [
  { ruleKey: "candle_confirm_1h", label: "Confirmation candle (1h)" },
  { ruleKey: "candle_confirm_15m", label: "Confirmation candle (15m)" },
  {
    ruleKey: "touch_disipador",
    label: "Disipador touch (candle + BB)",
  },
] as const;

export type AlarmEligibleRuleKey = (typeof ALARM_ELIGIBLE_RULES)[number]["ruleKey"];

/** Same TF for candle + Bollinger (touch_disipador). */
export type AlarmBandTimeframe = "1m" | "15m" | "1h";

export type AlarmTrend = "alcista" | "bajista";

export type AlarmWatchStatus = "idle" | "running" | "checking" | "met" | "stopped" | "error";

export type MarketAlarmWatch = {
  id: string;
  symbol: string;
  ruleKey: AlarmEligibleRuleKey;
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
};

export function alarmRuleLabel(ruleKey: string): string {
  return ALARM_ELIGIBLE_RULES.find((r) => r.ruleKey === ruleKey)?.label ?? ruleKey;
}

export function formatAlarmTrend(trend: AlarmTrend): string {
  return trend === "alcista" ? "Alcista" : "Bajista";
}

export function needsBandTimeframe(ruleKey: string): boolean {
  return ruleKey === "touch_disipador";
}
