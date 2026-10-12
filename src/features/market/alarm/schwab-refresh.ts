import { pollIntervalToMs, type PollIntervalUnit } from "@/shared/components/PollControls";

/** One Charles Schwab pull per ticker, on the shortest alarm interval for that ticker. */
export function schwabRefreshCooldownMs(intervalsMs: number[]): number {
  const positive = intervalsMs.filter((ms) => Number.isFinite(ms) && ms > 0);
  if (positive.length === 0) return 60_000;
  return Math.max(15_000, Math.min(...positive));
}

export function formatSchwabInterval(ms: number): string {
  if (ms % 3_600_000 === 0) {
    const hours = ms / 3_600_000;
    return hours === 1 ? "every 1 hour" : `every ${hours} hours`;
  }
  if (ms % 60_000 === 0) {
    const minutes = ms / 60_000;
    return minutes === 1 ? "every 1 min" : `every ${minutes} min`;
  }
  const seconds = Math.round(ms / 1000);
  return `every ${seconds}s`;
}

const POLLING_STATUSES = new Set(["running", "checking", "in_trade"]);

export function charlesCallLabel(
  watches: readonly {
    symbol: string;
    status: string;
    frequencyValue: number;
    frequencyUnit: PollIntervalUnit;
  }[],
  symbol: string,
): string | null {
  const upper = symbol.trim().toUpperCase();
  const intervals = watches
    .filter((watch) => watch.symbol.toUpperCase() === upper && POLLING_STATUSES.has(watch.status))
    .map((watch) => pollIntervalToMs(watch.frequencyValue, watch.frequencyUnit));
  if (intervals.length === 0) return null;
  return formatSchwabInterval(schwabRefreshCooldownMs(intervals));
}
