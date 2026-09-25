/** User-stopped / removed ORB auto tickers — do not restart on the next job sync. */

import { tradeDateEt } from "./orb5m-auto-job";

export type OrbAutoHoldKind = "orb15" | "orb5m";

const STORAGE_KEY = "oceanview.market.orb.auto.held";
const memoryStore = new Map<string, string>();

type HeldRecord = {
  tradeDate: string;
  orb15: string[];
  orb5m: string[];
};

function storageGet(): string | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage.getItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
  return memoryStore.get(STORAGE_KEY) ?? null;
}

function storageSet(value: string): void {
  memoryStore.set(STORAGE_KEY, value);
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore quota */
  }
}

function emptyRecord(tradeDate: string): HeldRecord {
  return { tradeDate, orb15: [], orb5m: [] };
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function readRecord(now: Date = new Date()): HeldRecord {
  const today = tradeDateEt(now);
  try {
    const raw = storageGet();
    if (!raw) return emptyRecord(today);
    const parsed = JSON.parse(raw) as Partial<HeldRecord>;
    const tradeDate = String(parsed.tradeDate || today);
    if (tradeDate !== today) return emptyRecord(today);
    return {
      tradeDate: today,
      orb15: Array.isArray(parsed.orb15) ? parsed.orb15.map(normalizeSymbol).filter(Boolean) : [],
      orb5m: Array.isArray(parsed.orb5m) ? parsed.orb5m.map(normalizeSymbol).filter(Boolean) : [],
    };
  } catch {
    return emptyRecord(today);
  }
}

function writeRecord(record: HeldRecord): void {
  storageSet(JSON.stringify(record));
}

export function heldOrbAutoSymbols(
  kind: OrbAutoHoldKind,
  now: Date = new Date(),
): Set<string> {
  const record = readRecord(now);
  return new Set(kind === "orb15" ? record.orb15 : record.orb5m);
}

export function isOrbAutoSymbolHeld(
  kind: OrbAutoHoldKind,
  symbol: string,
  now: Date = new Date(),
): boolean {
  const upper = normalizeSymbol(symbol);
  if (!upper) return false;
  return heldOrbAutoSymbols(kind, now).has(upper);
}

export function holdOrbAutoSymbol(
  kind: OrbAutoHoldKind,
  symbol: string,
  now: Date = new Date(),
): void {
  const upper = normalizeSymbol(symbol);
  if (!upper) return;
  const record = readRecord(now);
  const key = kind === "orb15" ? "orb15" : "orb5m";
  if (record[key].includes(upper)) return;
  writeRecord({ ...record, [key]: [...record[key], upper] });
}

export function releaseOrbAutoSymbol(
  kind: OrbAutoHoldKind,
  symbol: string,
  now: Date = new Date(),
): void {
  const upper = normalizeSymbol(symbol);
  if (!upper) return;
  const record = readRecord(now);
  const key = kind === "orb15" ? "orb15" : "orb5m";
  writeRecord({ ...record, [key]: record[key].filter((item) => item !== upper) });
}

export function holdKindForWatch(watch: {
  orbAuto?: boolean;
  orb5mAuto?: boolean;
}): OrbAutoHoldKind | null {
  if (watch.orb5mAuto) return "orb5m";
  if (watch.orbAuto) return "orb15";
  return null;
}

export function clearOrbAutoHolds(): void {
  memoryStore.delete(STORAGE_KEY);
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
