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
