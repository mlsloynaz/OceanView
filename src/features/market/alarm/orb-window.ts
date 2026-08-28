/**
 * ORB alarm window — 9:45–11:30 AM ET (opening range closed → mid-morning).
 */
import { watchRuleKeys, type MarketAlarmWatch } from "./alarm-types";

export const ORB_BREAKOUT_RULE_KEY = "orb_breakout" as const;

export const ORB_WINDOW_START_MINUTES_ET = 9 * 60 + 45;
export const ORB_WINDOW_END_MINUTES_ET = 11 * 60 + 30;

export const DEFAULT_ORB_AUTO_SYMBOLS = ["TSLA", "MSFT", "SPY"] as const;

export const ORB_WINDOW_WAIT_MESSAGE =
  "ORB opens at 9:45 AM ET (opening range must close first).";
export const ORB_WINDOW_CLOSED_MESSAGE = "ORB window closed (9:45–11:30 AM ET).";

const ET = "America/New_York";

export function easternClockMinutes(date: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  const hourRaw = map.hour === "24" ? "00" : (map.hour ?? "0");
  return Number(hourRaw) * 60 + Number(map.minute ?? 0);
}

export function isOrbWindowOpen(now: Date = new Date()): boolean {
  const mins = easternClockMinutes(now);
  return mins >= ORB_WINDOW_START_MINUTES_ET && mins <= ORB_WINDOW_END_MINUTES_ET;
}

export function orbWindowMessage(now: Date = new Date()): string | null {
  const mins = easternClockMinutes(now);
  if (mins < ORB_WINDOW_START_MINUTES_ET) return ORB_WINDOW_WAIT_MESSAGE;
  if (mins > ORB_WINDOW_END_MINUTES_ET) return ORB_WINDOW_CLOSED_MESSAGE;
  return null;
}

export function isOrbBreakoutWatch(
  watch: Pick<MarketAlarmWatch, "ruleKey" | "ruleKeys">,
): boolean {
  return watchRuleKeys(watch).includes(ORB_BREAKOUT_RULE_KEY);
}

export function isOrbAutoWatch(
  watch: Pick<MarketAlarmWatch, "orbAuto" | "ruleKey" | "ruleKeys">,
): boolean {
  return Boolean(watch.orbAuto) && isOrbBreakoutWatch(watch);
}
