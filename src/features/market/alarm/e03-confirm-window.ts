/**
 * Confirmación E03 (`volume_stoch_1h`) is only meaningful through 9:45 AM ET.
 * After that clock, drop watches, stop polling, and hide the SemiFinal queue.
 */
import { useEffect, useState } from "react";
import { watchRuleKeys, type MarketAlarmWatch } from "@/features/market/alarm/alarm-types";
import type { SemifinalMonitorCandidate } from "@/features/admin/setup-scan/semifinal-monitor-queue";

export const E03_CONFIRM_RULE_KEY = "volume_stoch_1h" as const;

/** 9:45 AM ET — window closed at this minute and after. */
export const E03_CONFIRM_END_MINUTES_ET = 9 * 60 + 45;

export const E03_CONFIRM_EXPIRED_MESSAGE =
  "Confirmación E03 ended at 9:45 AM ET — removed from Alarms.";

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

export function isE03ConfirmExpired(now: Date = new Date()): boolean {
  return easternClockMinutes(now) >= E03_CONFIRM_END_MINUTES_ET;
}

export function isE03ConfirmWatch(
  watch: Pick<MarketAlarmWatch, "ruleKey" | "ruleKeys">,
): boolean {
  return watchRuleKeys(watch).includes(E03_CONFIRM_RULE_KEY);
}

export function filterExpiredE03ConfirmQueue(
  rows: SemifinalMonitorCandidate[],
  now: Date = new Date(),
): SemifinalMonitorCandidate[] {
  if (!isE03ConfirmExpired(now)) return rows;
  return rows.filter((row) => row.confirmRuleKey !== E03_CONFIRM_RULE_KEY);
}

/** Re-render around the 9:45 ET cutoff so E03 UI can hide itself. */
export function useNowTick(intervalMs = 15_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
