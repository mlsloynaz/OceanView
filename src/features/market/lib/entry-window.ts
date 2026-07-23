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
