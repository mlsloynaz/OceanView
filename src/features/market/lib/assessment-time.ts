import type { CandleCoverage } from "../types";
import { isUsMarketDay, sessionCloseMinutesEt } from "@/shared/lib/market-calendar";

const ET = "America/New_York";

export function parseIsoToMs(iso: string): number {
  return new Date(iso).getTime();
}

/** `datetime-local` value interpreted as Eastern Time (YYYY-MM-DDTHH:mm or with :ss). */
export function parseEtDatetimeLocal(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  const [, y, mo, d, h, mi] = match;
  const utcGuess = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
  );

  for (const offsetHours of [-4, -5]) {
    const candidate = new Date(utcGuess - offsetHours * 60 * 60 * 1000);
    const parts = etParts(candidate);
    if (
      parts.year === y &&
      parts.month === mo &&
      parts.day === d &&
      parts.hour === h &&
      parts.minute === mi
    ) {
      return candidate;
    }
  }

  return new Date(`${y}-${mo}-${d}T${h}:${mi}:00-04:00`);
}

function etParts(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: map.year ?? "",
    month: map.month ?? "",
    day: map.day ?? "",
    hour: map.hour === "24" ? "00" : (map.hour ?? ""),
    minute: map.minute ?? "",
  };
}

/** Format a Date as `datetime-local` value in Eastern Time. */
export function formatEtDatetimeLocal(date: Date): string {
  const p = etParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function formatAssessmentDisplay(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function clampAssessmentTime(date: Date, coverage: CandleCoverage): Date {
  const ms = date.getTime();
  const min = parseIsoToMs(coverage.earliestAt);
  const max = parseIsoToMs(coverage.latestAt);
  if (ms < min) return new Date(min);
  if (ms > max) return new Date(max);
  return date;
}

export function defaultAssessmentTime(coverage: CandleCoverage): Date {
  return clampAssessmentTime(new Date(), coverage);
}

/** `now` — assess at click time; `et` — user picks an Eastern datetime. */
export type AssessmentTimeMode = "now" | "et";

const REGULAR_SESSION_OPEN_MINUTES = 9 * 60 + 30;
const REGULAR_SESSION_CLOSE_MINUTES = 16 * 60;

/**
 * True during US equity regular session (9:30–close ET) on a market day.
 * Outside RTH (pre-open, after close, weekend/holiday) Live should be disabled.
 */
export function isRegularMarketSessionEt(now = new Date()): boolean {
  const p = etParts(now);
  const calendar = parseEtDatetimeLocal(`${p.year}-${p.month}-${p.day}T12:00`);
  if (!calendar) return false;
  // Local Y/M/D of that noon-ET instant ≈ calendar day in ET for market-calendar helpers.
  const y = Number(p.year);
  const mo = Number(p.month);
  const d = Number(p.day);
  const localNoon = new Date(y, mo - 1, d, 12, 0, 0);
  if (!isUsMarketDay(localNoon)) return false;
  const minutes = Number(p.hour) * 60 + Number(p.minute);
  const close = sessionCloseMinutesEt(localNoon);
  return minutes >= REGULAR_SESSION_OPEN_MINUTES && minutes < close;
}

function etWeekday(date: Date): number {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: ET, weekday: "short" }).format(
    date,
  );
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[weekday] ?? 0;
}

function effectiveTradingDateEt(date: Date): string {
  const p = etParts(date);
  let cursor = parseEtDatetimeLocal(`${p.year}-${p.month}-${p.day}T12:00`);
  if (!cursor) return `${p.year}-${p.month}-${p.day}`;
  while (etWeekday(cursor) === 0 || etWeekday(cursor) === 6) {
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  const cp = etParts(cursor);
  return `${cp.year}-${cp.month}-${cp.day}`;
}

/** Now-mode Market assess: live clock in session; after close → 4:00 PM ET. */
export function resolveMarketNowAssessmentMoment(now = new Date()): Date {
  const p = etParts(now);
  const minutes = Number(p.hour) * 60 + Number(p.minute);
  const weekday = etWeekday(now);
  const isTradingDay = weekday >= 1 && weekday <= 5;

  if (!isTradingDay) {
    const tradeDate = effectiveTradingDateEt(now);
    return parseEtDatetimeLocal(`${tradeDate}T16:00`) ?? now;
  }

  if (minutes >= REGULAR_SESSION_CLOSE_MINUTES) {
    return parseEtDatetimeLocal(`${p.year}-${p.month}-${p.day}T16:00`) ?? now;
  }

  return now;
}

/** Now-mode Premarket assess: current Eastern clock (extended-hours bars fetched live). */
export function resolvePremarketNowAssessmentMoment(now = new Date()): Date {
  return now;
}

export type AssessmentTimeValidation = {
  /** Hard failure — blocks Assess (before stored history). */
  error: string | null;
  /** Soft hint — Assess is allowed; API may refresh candles first. */
  notice: string | null;
};

export type AssessmentTimeOptions = {
  /** ET mode — only stored candle history up to the chosen moment (no live refresh). */
  historicalOnly?: boolean;
};

export function blocksAssess(
  date: Date,
  coverage: CandleCoverage,
  options?: AssessmentTimeOptions,
): boolean {
  const ms = date.getTime();
  if (ms < parseIsoToMs(coverage.earliestAt)) return true;
  if (options?.historicalOnly && ms > parseIsoToMs(coverage.latestAt)) return true;
  return false;
}

export function validateAssessmentTime(
  date: Date,
  coverage: CandleCoverage,
  options?: AssessmentTimeOptions,
): AssessmentTimeValidation {
  const ms = date.getTime();
  const min = parseIsoToMs(coverage.earliestAt);
  const max = parseIsoToMs(coverage.latestAt);
  if (ms < min) {
    return {
      error: `Before earliest candle data (${formatAssessmentDisplay(new Date(min))}).`,
      notice: null,
    };
  }
  if (ms > max) {
    if (options?.historicalOnly) {
      return {
        error: `After latest candle data (${formatAssessmentDisplay(new Date(max))}). Pick a time within stored history.`,
        notice: null,
      };
    }
    return {
      error: null,
      notice: `Stored candles end ${formatAssessmentDisplay(new Date(max))}. Assess is allowed — Live will refresh from Schwab first.`,
    };
  }
  return { error: null, notice: null };
}

export function isAssessmentNow(date: Date, toleranceMs = 60_000): boolean {
  return Math.abs(date.getTime() - Date.now()) <= toleranceMs;
}

export function coverageBoundsForInput(coverage: CandleCoverage): {
  min: string;
  max: string;
} {
  return {
    min: formatEtDatetimeLocal(new Date(coverage.earliestAt)),
    max: formatEtDatetimeLocal(new Date(coverage.latestAt)),
  };
}

/** Format assessment moment for POST /market/evaluate (ISO8601 with ET offset). */
export function formatSimulationTimeEt(date: Date): string {
  const p = etParts(date);
  const offset = etOffsetHours(date);
  const sign = offset <= 0 ? "-" : "+";
  const abs = String(Math.abs(offset)).padStart(2, "0");
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00${sign}${abs}:00`;
}

function etOffsetHours(date: Date): number {
  const p = etParts(date);
  const utcGuess = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
  );
  for (const offsetHours of [-4, -5]) {
    const candidate = new Date(utcGuess - offsetHours * 60 * 60 * 1000);
    const check = etParts(candidate);
    if (
      check.year === p.year &&
      check.month === p.month &&
      check.day === p.day &&
      check.hour === p.hour &&
      check.minute === p.minute
    ) {
      return offsetHours;
    }
  }
  return -4;
}

export function parseSimulationTimeEt(iso: string | null | undefined): Date | null {
  if (!iso?.trim()) return null;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
