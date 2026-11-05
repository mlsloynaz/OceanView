import { fetchJson } from "./alarm-client";
import type { BbSparkline15mBar } from "./alarm-types";

const OPEN_MINUTE = 9 * 60 + 30;
const ELEVEN = 11 * 60;
const CLOSE_MINUTE = 16 * 60;

export type AlpacaSession = {
  keyId: string;
  secretKey: string;
  feed: string;
};

type MinuteBar = {
  t?: string;
  o?: number;
  h?: number;
  l?: number;
  c?: number;
  v?: number;
};

let sessionPromise: Promise<AlpacaSession | null> | null = null;

export function nextFormingDelayMs(now: Date): number | null {
  const minutes = etMinutes(now);
  if (minutes == null) return null;
  if (minutes < OPEN_MINUTE || minutes >= CLOSE_MINUTE) return null;
  return minutes < ELEVEN ? 10_000 : 30_000;
}

export function mergeFormingMinute(
  base: BbSparkline15mBar[],
  forming: BbSparkline15mBar | null | undefined,
  now: Date,
): BbSparkline15mBar[] {
  if (!forming?.datetime) return base;
  const minute = forming.datetime.slice(0, 16);
  const current = etStamp(now)?.slice(0, 16);
  const schwabHasMinute = base.some((bar) => bar.datetime.slice(0, 16) === minute);
  if (current != null && minute < current && schwabHasMinute) {
    return base.map((bar) => (bar.datetime.slice(0, 16) === minute ? { ...bar, forming: false } : bar));
  }
  const rest = base.filter((bar) => bar.datetime.slice(0, 16) !== minute);
  const bar = { ...forming, forming: current != null && minute === current };
  return [...rest, bar].sort((left, right) => left.datetime.localeCompare(right.datetime));
}

export function barFromAlpacaMinute(row: MinuteBar | null | undefined): BbSparkline15mBar | null {
  if (!row?.t) return null;
  const datetime = etStamp(new Date(row.t));
  const close = Number(row.c);
  if (!datetime || !Number.isFinite(close)) return null;
  const open = Number(row.o);
  const high = Number(row.h);
  const low = Number(row.l);
  return {
    datetime,
    open: Number.isFinite(open) ? open : close,
    high: Number.isFinite(high) ? high : close,
    low: Number.isFinite(low) ? low : close,
    close,
    bbUpper: null,
    bbMid: null,
    bbLower: null,
    forming: true,
  };
}

export function loadAlpacaSession(): Promise<AlpacaSession | null> {
  if (sessionPromise) return sessionPromise;
  const pending = fetchJson<AlpacaSession>("/market/board/alpaca-session", { method: "GET" })
    .then((session) => {
      if (!session?.keyId || !session.secretKey) {
        sessionPromise = null;
        return null;
      }
      return session;
    })
    .catch(() => {
      sessionPromise = null;
      return null;
    });
  sessionPromise = pending;
  return pending;
}

export async function fetchFormingMinutes(
  symbols: string[],
  session: AlpacaSession,
): Promise<Record<string, BbSparkline15mBar>> {
  const out: Record<string, BbSparkline15mBar> = {};
  const feed = session.feed || "iex";
  for (let index = 0; index < symbols.length; index += 50) {
    const chunk = symbols.slice(index, index + 50);
    if (chunk.length === 0) continue;
    const params = new URLSearchParams({ symbols: chunk.join(","), feed });
    const response = await fetch(`https://data.alpaca.markets/v2/stocks/snapshots?${params.toString()}`, {
      headers: {
        "APCA-API-KEY-ID": session.keyId,
        "APCA-API-SECRET-KEY": session.secretKey,
        Accept: "application/json",
      },
    });
    if (!response.ok) continue;
    const body = (await response.json()) as Record<string, { minuteBar?: MinuteBar }>;
    for (const symbol of chunk) {
      const bar = barFromAlpacaMinute(body[symbol]?.minuteBar);
      if (bar) out[symbol] = bar;
    }
  }
  return out;
}

function etMinutes(now: Date): number | null {
  const parts = etParts(now);
  if (!parts) return null;
  if (parts.weekday === "Sat" || parts.weekday === "Sun") return null;
  return Number(parts.hour) * 60 + Number(parts.minute);
}

function etStamp(now: Date): string | null {
  const parts = etParts(now);
  if (!parts) return null;
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:00`;
}

function etParts(now: Date): {
  weekday: string;
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
} | null {
  if (Number.isNaN(now.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  let hour = value("hour");
  if (hour === "24") hour = "00";
  return {
    weekday: value("weekday"),
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour,
    minute: value("minute"),
  };
}
