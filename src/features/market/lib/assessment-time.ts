import type { CandleCoverage } from "../types";

const ET = "America/New_York";

export function parseIsoToMs(iso: string): number {
  return new Date(iso).getTime();
}

/** `datetime-local` value interpreted as Eastern Time (YYYY-MM-DDTHH:mm). */
export function parseEtDatetimeLocal(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
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

export function validateAssessmentTime(
  date: Date,
  coverage: CandleCoverage,
): string | null {
  const ms = date.getTime();
  const min = parseIsoToMs(coverage.earliestAt);
  const max = parseIsoToMs(coverage.latestAt);
  if (ms < min) {
    return `Before earliest candle data (${formatAssessmentDisplay(new Date(min))}).`;
  }
  if (ms > max) {
    return `After latest candle data (${formatAssessmentDisplay(new Date(max))}). Refresh candles in Admin, then try again.`;
  }
  return null;
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
