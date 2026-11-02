import type { Plugin } from "vite";

type MinutePoint = {
  datetime: string;
  close: number;
  ema10: number | null;
  ema21: number | null;
};

const cache = new Map<string, { at: number; points: MinutePoint[] }>();
const CACHE_MS = 60_000;
const TAIL = 120;

function ema(closes: number[], period: number): Array<number | null> {
  const out: Array<number | null> = closes.map(() => null);
  if (period <= 1 || closes.length < period) return out;
  const alpha = 2 / (period + 1);
  let prev = closes.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  out[period - 1] = prev;
  for (let index = period; index < closes.length; index += 1) {
    prev = closes[index]! * alpha + prev * (1 - alpha);
    out[index] = prev;
  }
  return out;
}

function etParts(epochSec: number): { date: string; minutes: number; stamp: string } | null {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(epochSec * 1000));
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  const hour = Number(pick("hour"));
  const minute = Number(pick("minute"));
  if (!year || !month || !day || !Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return {
    date: `${year}-${month}-${day}`,
    minutes: hour * 60 + minute,
    stamp: `${year}-${month}-${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-05:00`,
  };
}

function lineFromYahoo(payload: unknown): MinutePoint[] {
  const chart = payload as {
    chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> };
  };
  const row = chart.chart?.result?.[0];
  const stamps = row?.timestamp ?? [];
  const closes = row?.indicators?.quote?.[0]?.close ?? [];
  const session: Array<{ stamp: string; date: string; close: number }> = [];
  for (let index = 0; index < stamps.length; index += 1) {
    const close = closes[index];
    const clock = etParts(stamps[index] ?? 0);
    if (!clock || close == null || !Number.isFinite(close)) continue;
    if (clock.minutes < 9 * 60 + 30 || clock.minutes >= 16 * 60) continue;
    session.push({ stamp: clock.stamp, date: clock.date, close });
  }
  if (session.length < 2) return [];
  const day = session[session.length - 1]!.date;
  const today = session.filter((point) => point.date === day);
  const used = today.length >= 2 ? today : session;
  const fast = ema(used.map((point) => point.close), 10);
  const slow = ema(used.map((point) => point.close), 21);
  return used.slice(-TAIL).map((point, offset) => {
    const index = used.length - Math.min(used.length, TAIL) + offset;
    return {
      datetime: point.stamp,
      close: Math.round(point.close * 10000) / 10000,
      ema10: fast[index] == null ? null : Math.round(fast[index]! * 10000) / 10000,
      ema21: slow[index] == null ? null : Math.round(slow[index]! * 10000) / 10000,
    };
  });
}

async function loadMinuteLine(symbol: string): Promise<MinutePoint[]> {
  const key = symbol.trim().toUpperCase().replaceAll(".", "-");
  if (!key) return [];
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.points;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(key)}?interval=1m&range=1d&includePrePost=false`;
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0", accept: "application/json" },
  });
  if (!response.ok) return [];
  const points = lineFromYahoo(await response.json());
  cache.set(key, { at: Date.now(), points });
  return points;
}

/** Dev-only 1-minute close and EMAs for the thumbnail corner. */
export function minuteLinePlugin(): Plugin {
  return {
    name: "oceanview-minute-line",
    configureServer(server) {
      server.middlewares.use("/dev/minute-line", (req, res) => {
        const symbol = new URL(req.url ?? "/", "http://localhost").searchParams.get("symbol") ?? "";
        void loadMinuteLine(symbol)
          .then((points) => {
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify(points));
          })
          .catch(() => {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end("[]");
          });
      });
    },
  };
}
