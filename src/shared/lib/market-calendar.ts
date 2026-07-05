/**
 * NYSE-style US equity market calendar (holidays + early closes).
 * Keep in sync with OceanView-API/src/domain/market_calendar.py
 */

const REGULAR_SESSION_CLOSE_MINUTES = 16 * 60;
const EARLY_SESSION_CLOSE_MINUTES = 13 * 60;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseIsoDate(text: string): Date | null {
  const trimmed = text.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [y, mo, d] = trimmed.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month - 1, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month - 1, 1 + offset + 7 * (n - 1));
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month - 1, last.getDate() - offset);
}

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const ell = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * ell) / 451);
  const month = Math.floor((h + ell - 7 * m + 114) / 31);
  const day = ((h + ell - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function observeFixedHoliday(raw: Date): Date {
  const day = raw.getDay();
  if (day === 6) return new Date(raw.getFullYear(), raw.getMonth(), raw.getDate() - 1);
  if (day === 0) return new Date(raw.getFullYear(), raw.getMonth(), raw.getDate() + 1);
  return raw;
}

function dateKey(d: Date): string {
  return toIsoDate(d);
}

function fixedHolidays(year: number): Set<string> {
  return new Set([
    dateKey(observeFixedHoliday(new Date(year, 0, 1))),
    dateKey(nthWeekdayOfMonth(year, 1, 1, 3)),
    dateKey(nthWeekdayOfMonth(year, 2, 1, 3)),
    dateKey(new Date(easterSunday(year).getTime() - 2 * 86400000)),
    dateKey(lastWeekdayOfMonth(year, 5, 1)),
    dateKey(observeFixedHoliday(new Date(year, 5, 19))),
    dateKey(observeFixedHoliday(new Date(year, 6, 4))),
    dateKey(nthWeekdayOfMonth(year, 9, 1, 1)),
    dateKey(nthWeekdayOfMonth(year, 11, 4, 4)),
    dateKey(observeFixedHoliday(new Date(year, 11, 25))),
  ]);
}

function independenceObserved(year: number): Date {
  return observeFixedHoliday(new Date(year, 6, 4));
}

function dayBeforeIndependenceEarlyClose(year: number): Date | null {
  const observed = independenceObserved(year);
  if (observed.getMonth() === 6 && observed.getDate() === 3) return null;
  let candidate = new Date(observed.getFullYear(), observed.getMonth(), observed.getDate() - 1);
  while (candidate.getDay() === 0 || candidate.getDay() === 6) {
    candidate = new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate() - 1);
  }
  if (candidate.getMonth() !== 6) return null;
  return candidate;
}

function earlyCloseDays(year: number): Set<string> {
  const closed = fixedHolidays(year);
  const early = new Set<string>();

  const thanksgiving = nthWeekdayOfMonth(year, 11, 4, 4);
  const blackFriday = new Date(thanksgiving.getFullYear(), thanksgiving.getMonth(), thanksgiving.getDate() + 1);
  if (blackFriday.getDay() < 5 && !closed.has(dateKey(blackFriday))) {
    early.add(dateKey(blackFriday));
  }

  const christmasObserved = observeFixedHoliday(new Date(year, 11, 25));
  const christmasEve = new Date(year, 11, 24);
  if (
    christmasEve.getDay() < 5 &&
    !closed.has(dateKey(christmasEve)) &&
    dateKey(christmasEve) !== dateKey(christmasObserved)
  ) {
    early.add(dateKey(christmasEve));
  }

  const beforeIndep = dayBeforeIndependenceEarlyClose(year);
  if (beforeIndep && !closed.has(dateKey(beforeIndep))) {
    early.add(dateKey(beforeIndep));
  }

  return early;
}

const yearCache = new Map<number, { closed: Set<string>; early: Set<string> }>();

function yearData(year: number): { closed: Set<string>; early: Set<string> } {
  let cached = yearCache.get(year);
  if (!cached) {
    cached = { closed: fixedHolidays(year), early: earlyCloseDays(year) };
    yearCache.set(year, cached);
  }
  return cached;
}

export function isUsMarketDay(d: Date): boolean {
  if (d.getDay() === 0 || d.getDay() === 6) return false;
  return !yearData(d.getFullYear()).closed.has(dateKey(d));
}

export function isUsEarlyCloseDay(d: Date): boolean {
  if (!isUsMarketDay(d)) return false;
  return yearData(d.getFullYear()).early.has(dateKey(d));
}

export function sessionCloseMinutesEt(d: Date): number {
  return isUsEarlyCloseDay(d) ? EARLY_SESSION_CLOSE_MINUTES : REGULAR_SESSION_CLOSE_MINUTES;
}

export function previousUsMarketDay(d: Date): Date {
  const cursor = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  for (let i = 0; i < 366; i += 1) {
    if (isUsMarketDay(cursor)) return cursor;
    cursor.setDate(cursor.getDate() - 1);
  }
  throw new Error(`No prior market day found before ${toIsoDate(d)}`);
}

export function lastUsMarketDayOnOrBefore(d: Date): Date {
  const cursor = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  for (let i = 0; i < 366; i += 1) {
    if (isUsMarketDay(cursor)) return cursor;
    cursor.setDate(cursor.getDate() - 1);
  }
  throw new Error(`No market day on or before ${toIsoDate(d)}`);
}

/** Latest selectable session for setup-scan simulate (last completed NYSE day ≤ today ET). */
export function maxSimulationSessionDate(now = new Date()): string {
  return toIsoDate(lastUsMarketDayOnOrBefore(now));
}

export function defaultSimulationSessionDate(now = new Date()): string {
  return maxSimulationSessionDate(now);
}

export function validateSimulationSessionDate(dateStr: string, now = new Date()): string | null {
  const parsed = parseIsoDate(dateStr);
  if (!parsed) return "Session date must be YYYY-MM-DD.";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (parsed > today) return "Session date cannot be in the future.";
  if (!isUsMarketDay(parsed)) {
    const suggested = toIsoDate(lastUsMarketDayOnOrBefore(parsed));
    return `${dateStr} is not a US equity market session (weekend or holiday). Try ${suggested}.`;
  }
  return null;
}

export function isValidSimulationSessionDate(dateStr: string, now = new Date()): boolean {
  return validateSimulationSessionDate(dateStr, now) === null;
}
