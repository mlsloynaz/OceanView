export type EntryWindowObject = {
  startEt: string;
  endEt: string;
  timezone?: string;
};

/** Catalog entry window — legacy string or structured ET range from API. */
export type EntryWindow = string | EntryWindowObject;

export function formatEntryWindow(value: EntryWindow | undefined | null): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  const start = value.startEt?.trim();
  const end = value.endEt?.trim();
  if (start && end) return `${start}–${end} ET`;
  if (start) return `${start} ET`;
  if (end) return `until ${end} ET`;
  return null;
}

/** Minutes from midnight ET for a Date (0–1439). */
function minutesOfDayEt(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const hour = Number(map.hour === "24" ? "0" : map.hour);
  const minute = Number(map.minute);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return hour * 60 + minute;
}

function parseHmToMinutes(raw: string | undefined | null): number | null {
  const text = String(raw ?? "").trim();
  const match = /^(\d{1,2}):(\d{2})/.exec(text);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

/**
 * True when the strategy should be included in Market assess.
 * No structured entryWindow → always eligible. Legacy string windows are ignored (always in).
 */
export function isStrategyInEntryWindow(
  entryWindow: EntryWindow | undefined | null,
  at: Date,
): boolean {
  if (entryWindow == null || typeof entryWindow === "string") return true;
  const start = parseHmToMinutes(entryWindow.startEt);
  const end = parseHmToMinutes(entryWindow.endEt);
  if (start == null || end == null || start > end) return true;
  const nowMin = minutesOfDayEt(at);
  return nowMin >= start && nowMin <= end;
}

/** HH:MM for `<input type="time">` from a structured window (empty if legacy string). */
export function entryWindowTimeFields(
  value: EntryWindow | undefined | null,
): { startEt: string; endEt: string; legacyLabel: string | null } {
  if (value == null) {
    return { startEt: "", endEt: "", legacyLabel: null };
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return { startEt: "", endEt: "", legacyLabel: trimmed || null };
  }
  return {
    startEt: normalizeHm(value.startEt),
    endEt: normalizeHm(value.endEt),
    legacyLabel: null,
  };
}

/** Structured payload for create/patch, or null to clear. Throws if only one side set. */
export function buildEntryWindowPayload(
  startEt: string,
  endEt: string,
): EntryWindowObject | null {
  const start = normalizeHm(startEt);
  const end = normalizeHm(endEt);
  if (!start && !end) return null;
  if (!start || !end) {
    throw new Error("Entry window needs both start and end (ET), or leave both empty.");
  }
  if (start > end) {
    throw new Error("Entry window start must be at or before end.");
  }
  return { startEt: start, endEt: end, timezone: "America/New_York" };
}

function normalizeHm(raw: string | undefined | null): string {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  const match = /^(\d{1,2}):(\d{2})/.exec(text);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "";
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
