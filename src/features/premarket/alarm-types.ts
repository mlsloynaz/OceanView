export type AlarmFrequencyUnit = "min" | "hour";

export type AlarmWatchStatus = "idle" | "running" | "checking" | "met" | "stopped" | "error";

export type PremarketAlarmWatch = {
  id: string;
  symbol: string;
  strategyId: string;
  strategyName: string;
  /** Interval magnitude; combined with unit (min floor = 1). */
  frequencyValue: number;
  frequencyUnit: AlarmFrequencyUnit;
  thresholdPct: number;
  status: AlarmWatchStatus;
  lastQualityPct: number | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  metAt: string | null;
};

export function alarmIntervalMs(value: number, unit: AlarmFrequencyUnit): number {
  const safe = Math.max(1, Math.floor(value) || 1);
  return unit === "hour" ? safe * 60 * 60 * 1000 : safe * 60 * 1000;
}

export function formatAlarmFrequency(value: number, unit: AlarmFrequencyUnit): string {
  const safe = Math.max(1, Math.floor(value) || 1);
  if (unit === "hour") {
    return safe === 1 ? "every 1 hour" : `every ${safe} hours`;
  }
  return safe === 1 ? "every 1 min" : `every ${safe} min`;
}
