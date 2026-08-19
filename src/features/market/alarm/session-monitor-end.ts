/**
 * All Alarms polling stops at 4:00 PM ET. Watches stay on the board as stopped
 * until the next session (they do not resume overnight).
 */
import { easternClockMinutes } from "./e03-confirm-window";
import type { MarketAlarmWatch } from "./alarm-types";

/** 4:00 PM ET regular session close. */
export const SESSION_MONITOR_END_MINUTES_ET = 16 * 60;

export const SESSION_MONITOR_ENDED_MESSAGE =
  "Session ended at 4:00 PM ET — monitoring stopped.";

export function isSessionMonitorEnded(now: Date = new Date()): boolean {
  return easternClockMinutes(now) >= SESSION_MONITOR_END_MINUTES_ET;
}

export function isActivelyMonitoringWatch(
  watch: Pick<MarketAlarmWatch, "status">,
): boolean {
  return (
    watch.status === "running" ||
    watch.status === "checking" ||
    watch.status === "paused" ||
    watch.status === "in_trade"
  );
}
