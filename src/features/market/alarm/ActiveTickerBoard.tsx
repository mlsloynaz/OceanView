import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { AlarmSignalTag, type AlarmStripTag } from "./AlarmSignalStrip";
import { TickerMark } from "./TickerMark";
import { BbSparkline15mChart } from "./BbSparkline15mChart";
import { THUMB_GAP_PX, fitThumbnailGrid } from "./fit-thumbnail-grid";
import { fetchFormingMinutes, loadAlpacaSession, mergeFormingMinute, nextFormingDelayMs } from "./alpaca-forming-minute";
import { fetchBoardSnapshot, fetchMovementWatchResults } from "./alarm-client";
import type { BbSparkline15m, BbSparkline15mBar } from "./alarm-types";
import { angleOnResetScale } from "./ema-angle-scale";

type Frame = "5m" | "15m" | "1m";
type PaneFilter = Frame | "all";

const PANE_FILTERS: Array<{ id: PaneFilter; label: string }> = [
  { id: "1m", label: "1m" },
  { id: "15m", label: "15m" },
  { id: "5m", label: "5m" },
  { id: "all", label: "All" },
];

export type ThumbnailFrame = PaneFilter;

export function ThumbnailFrameFilters({
  frame,
  onChange,
  prominent = false,
}: {
  frame: ThumbnailFrame;
  onChange: (frame: ThumbnailFrame) => void;
  prominent?: boolean;
}) {
  return (
    <div className="flex gap-1" role="group" aria-label="Thumbnail timeframe">
      {PANE_FILTERS.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={frame === option.id}
          className={cn(
            "rounded font-semibold",
            prominent ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]",
            frame === option.id ? "bg-ocean-teal text-ocean-deep" : "border border-ocean-mid/40 text-ocean-sand",
          )}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const THUMB_ORDER_KEY = "oceanview.thumbnailOrder";
const THUMB_ORDER_EVENT = "oceanview-thumbnail-order";

function readThumbOrder(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(THUMB_ORDER_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map((symbol) => String(symbol || "").trim().toUpperCase()).filter(Boolean);
  } catch {
    return [];
  }
}

function writeThumbOrder(symbols: string[]): void {
  try {
    localStorage.setItem(THUMB_ORDER_KEY, JSON.stringify(symbols));
    globalThis.dispatchEvent(new Event(THUMB_ORDER_EVENT));
  } catch {
    /* the grid still moves for this page */
  }
}

function arrangeTickers<T extends { symbol: string }>(tickers: T[], order: string[]): T[] {
  const bySymbol = new Map(tickers.map((ticker) => [ticker.symbol.toUpperCase(), ticker]));
  const seen = new Set<string>();
  const arranged: T[] = [];
  for (const symbol of order) {
    const ticker = bySymbol.get(symbol);
    if (!ticker || seen.has(symbol)) continue;
    seen.add(symbol);
    arranged.push(ticker);
  }
  for (const ticker of tickers) {
    const symbol = ticker.symbol.toUpperCase();
    if (seen.has(symbol)) continue;
    arranged.push(ticker);
  }
  return arranged;
}

type Panes = Record<Frame, BbSparkline15mBar[]>;

export type BoardSnapshotView = Snapshot;

type Snapshot = {
  label: string;
  windowStartEt: string;
  windowEndEt: string;
  bySymbol: Record<
    string,
    {
      panes: Panes;
      error?: string | null;
      entryAt?: string | null;
      entrySide?: "CALL" | "PUT" | null;
      breakoutLevel?: number | null;
      premarketPrice?: number | null;
      hourRelation?: string | null;
      hourRegime?: string | null;
      sectorEtf?: string | null;
      etfMatch?: boolean | null;
      sentiment?: "bull S" | "bear S" | null;
      note?: string | null;
    }
  >;
};

const emptyPanes: Panes = { "5m": [], "15m": [], "1m": [] };
const SECTOR_ETF: Record<string, "SMH" | "XLK"> = {
  NVDA: "SMH",
  AVGO: "SMH",
  AAPL: "XLK",
  MSFT: "XLK",
  ORCL: "XLK",
  PLTR: "XLK",
};

export function fiveMinuteMove(closes: number[]): 1 | -1 | null {
  const last = closes.at(-1);
  const previous = closes.at(-2);
  if (last == null || previous == null) return null;
  if (last > previous) return 1;
  if (last < previous) return -1;
  return null;
}

function emaNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/**
 * Angle of the EMA 10 line on a reset chart.
 * The visible high and low fill the pane. `aspect` is the pane's width / height.
 * One bar whose rise matches that fit is 45°.
 */
export function latestEmaAngle(bars: BbSparkline15mBar[], aspect = 1): number | null {
  const closes = bars
    .map((bar) => emaNumber(bar.close))
    .filter((value): value is number => value != null && value > 0);
  const anchor = closes.length ? closes[Math.floor(closes.length / 2)]! : 0;
  const onScale = (value: number) => value > 0 && (anchor <= 0 || Math.abs(value - anchor) / anchor <= 0.4);
  const prices: number[] = [];
  const line: Array<{ index: number; ema: number }> = [];
  bars.forEach((bar, index) => {
    for (const value of [bar.high, bar.low, bar.close, bar.ema10, bar.ema21, bar.bbUpper, bar.bbLower]) {
      const price = emaNumber(value);
      if (price != null && onScale(price)) prices.push(price);
    }
    const ema = emaNumber(bar.ema10);
    if (ema != null && onScale(ema)) line.push({ index, ema });
  });
  if (line.length < 2 || prices.length < 2) return null;
  // The eye follows the right-hand side of the line. A rise earlier in the pane
  // does not keep the angle positive once that side is falling.
  const tail = line.slice(-Math.max(2, Math.ceil(line.length / 3)));
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (const point of tail) {
    sumX += point.index;
    sumY += point.ema;
    sumXX += point.index * point.index;
    sumXY += point.index * point.ema;
  }
  const denom = tail.length * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (tail.length * sumXY - sumX * sumY) / denom;
  return angleOnResetScale(slope, Math.min(...prices), Math.max(...prices), aspect, bars.length);
}

export type AnglePick = { symbol: string; angle: number };
export type AngleLeaders = Record<Frame, { up: AnglePick | null; down: AnglePick | null }>;

const ANGLE_FRAMES: Frame[] = ["1m", "5m", "15m"];
/** Width / height of each pane. Matches the solo graph boxes. */
const PANE_ASPECT: Record<Frame, number> = { "1m": 15 / 8, "5m": 23 / 12, "15m": 1 };

export function angleLeaders(rows: Array<{ symbol: string; panes: Panes | undefined }>): AngleLeaders {
  const leaders = {} as AngleLeaders;
  for (const frame of ANGLE_FRAMES) {
    const ranked = rows.flatMap((row) => {
      const angle = latestEmaAngle(row.panes?.[frame] ?? [], PANE_ASPECT[frame]);
      return angle == null ? [] : [{ symbol: row.symbol.trim().toUpperCase(), angle }];
    });
    if (ranked.length === 0) {
      leaders[frame] = { up: null, down: null };
      continue;
    }
    const up = ranked.reduce((best, row) => (row.angle > best.angle ? row : best));
    const down = ranked.reduce((best, row) => (row.angle < best.angle ? row : best));
    leaders[frame] = {
      up: up.angle > 0 ? up : null,
      down: down.angle < 0 ? down : null,
    };
  }
  return leaders;
}

function formatAngle(angle: number): string {
  const sign = angle > 0 ? "+" : "";
  return `${sign}${angle.toFixed(1)}°`;
}

export type AngleMark = { frame: Frame; tone: "up" | "down"; angle: number };

/** Steepest rise and drop for this ticker. Independent of which pane is on screen. */
export function angleMarksFor(leaders: AngleLeaders, symbol: string): AngleMark[] {
  const key = symbol.trim().toUpperCase();
  const marks: AngleMark[] = [];
  for (const frame of ANGLE_FRAMES) {
    const up = leaders[frame].up;
    const down = leaders[frame].down;
    if (up?.symbol === key) marks.push({ frame, tone: "up", angle: up.angle });
    if (down?.symbol === key) marks.push({ frame, tone: "down", angle: down.angle });
  }
  return marks;
}

function AngleBadge({ mark }: { mark: AngleMark }) {
  const up = mark.tone === "up";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-px font-display text-[9px] font-bold leading-none tabular-nums text-white",
        up ? "bg-[#0f766e]" : "bg-[#9f1239]",
      )}
      title={`Steepest ${up ? "positive" : "negative"} EMA 10 on ${mark.frame}`}
    >
      {mark.frame} {up ? "▲" : "▼"} {formatAngle(mark.angle)}
    </span>
  );
}

function AngleLeadersBar({ leaders }: { leaders: AngleLeaders }) {
  const any = ANGLE_FRAMES.some((frame) => leaders[frame].up || leaders[frame].down);
  if (!any) return null;
  return (
    <div
      className="rounded border border-ocean-mid/40 bg-ocean-deep/40 px-2 py-1.5"
      aria-label="Steepest EMA 10 angle by timeframe"
    >
      <ul className="space-y-1">
        {ANGLE_FRAMES.map((frame) => (
          <li key={frame} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
            <span className="w-8 shrink-0 font-display font-bold text-ocean-foam">{frame}</span>
            <span className="text-ocean-sand">positive</span>
            <AngleChoice pick={leaders[frame].up} tone="up" />
            <span className="text-ocean-sand">negative</span>
            <AngleChoice pick={leaders[frame].down} tone="down" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function AngleChoice({ pick, tone }: { pick: AnglePick | null; tone: "up" | "down" }) {
  if (!pick) return <span className="text-ocean-sand">none</span>;
  return (
    <span className={cn("inline-flex items-center", tone === "up" ? "text-ocean-teal" : "text-ocean-danger")}>
      <TickerMark symbol={pick.symbol} />
      <span className="font-display font-bold">{pick.symbol}</span>
      <span className="ml-1 tabular-nums">{formatAngle(pick.angle)}</span>
    </span>
  );
}

function etfComparison(
  symbol: string,
  companyBars: BbSparkline15mBar[],
  etfMoves: Record<string, 1 | -1 | null>,
  apiEtf: string | null,
  apiMatch: boolean | null,
): { etf: string; match: boolean } | null {
  const etf = SECTOR_ETF[symbol.trim().toUpperCase()] ?? apiEtf;
  if (!etf) return null;
  const companyMove = fiveMinuteMove(companyBars.map((bar) => bar.close));
  const etfMove = etfMoves[etf];
  if (companyMove != null && (etfMove === 1 || etfMove === -1)) {
    return { etf, match: companyMove === etfMove };
  }
  if (apiEtf && apiMatch != null) return { etf: apiEtf, match: apiMatch };
  return null;
}

function useEtfMoves(enabled: boolean): Record<string, 1 | -1 | null> {
  const [moves, setMoves] = useState<Record<string, 1 | -1 | null>>({});
  useEffect(() => {
    if (!enabled) return;
    let cancel = false;
    let timer = 0;
    const tick = () => {
      void loadAlpacaSession()
        .then((session) => {
          if (cancel || !session) return null;
          const start = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
          const headers = {
            "APCA-API-KEY-ID": session.keyId,
            "APCA-API-SECRET-KEY": session.secretKey,
            Accept: "application/json",
          };
          return Promise.all(
            ["SMH", "XLK"].map(async (symbol) => {
              const params = new URLSearchParams({
                symbols: symbol,
                timeframe: "5Min",
                start,
                limit: "20",
                feed: session.feed || "iex",
              });
              const response = await fetch(`https://data.alpaca.markets/v2/stocks/bars?${params.toString()}`, {
                headers,
              });
              const body = response.ok
                ? ((await response.json()) as { bars?: Record<string, Array<{ c?: number }>> })
                : null;
              const closes = (body?.bars?.[symbol] ?? [])
                .map((bar) => Number(bar.c))
                .filter((close) => Number.isFinite(close));
              return [symbol, fiveMinuteMove(closes)] as const;
            }),
          );
        })
        .then((rows: Array<readonly [string, 1 | -1 | null]> | null) => {
          if (cancel || !rows) return;
          setMoves(Object.fromEntries(rows));
        })
        .catch(() => {});
      timer = window.setTimeout(tick, 60_000);
    };
    tick();
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, [enabled]);
  return moves;
}
const ALL_1M_BARS = 60;
const SOLO_1M_BARS = 30;
const TWO_HOURS_5M_BARS = 24;
const SESSION_15M_BARS = 26;
/** All-view cell is 23/20 wide. Pane shape follows that grid: 5m is the top row, 1m and 15m split the bottom. */
const SOLO_PANE_ASPECT: Record<Frame, string> = {
  "5m": "23 / 12",
  "1m": "15 / 8",
  "15m": "1 / 1",
};

function soloPaneBox(aspect: string): { aspectRatio: string; width: string; height: string } {
  const [widthPart, heightPart] = aspect.split("/").map((part) => Number(part.trim()));
  return {
    aspectRatio: aspect,
    width: `min(100cqw, calc(100cqh * ${widthPart} / ${heightPart}))`,
    height: `min(100cqh, calc(100cqw * ${heightPart} / ${widthPart}))`,
  };
}

function visiblePanes(panes: Panes | undefined): Panes {
  return {
    "1m": (panes?.["1m"] ?? []).slice(-ALL_1M_BARS),
    "5m": (panes?.["5m"] ?? []).slice(-TWO_HOURS_5M_BARS),
    "15m": (panes?.["15m"] ?? []).slice(-SESSION_15M_BARS),
  };
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function relationClass(relation: string): string {
  const base = "truncate font-display text-xs font-bold tracking-wide";
  if (relation === "WITH_TREND") return `${base} text-ocean-teal`;
  if (relation === "COUNTERTREND") return `${base} text-ocean-danger`;
  return `${base} text-amber-400`;
}

function asBars(body: unknown): BbSparkline15mBar[] {
  if (!Array.isArray(body)) return [];
  return body.flatMap((point) => {
    if (!point || typeof point !== "object") return [];
    const row = point as Partial<BbSparkline15mBar>;
    const close = Number(row.close);
    if (!Number.isFinite(close) || !row.datetime) return [];
    const open = Number(row.open);
    const high = Number(row.high);
    const low = Number(row.low);
    return [
      {
        datetime: row.datetime,
        open: Number.isFinite(open) ? open : close,
        high: Number.isFinite(high) ? high : close,
        low: Number.isFinite(low) ? low : close,
        close,
        bbUpper: row.bbUpper ?? null,
        bbMid: row.bbMid ?? null,
        bbLower: row.bbLower ?? null,
        ema10: row.ema10 ?? null,
        ema21: row.ema21 ?? null,
        forming: row.forming === true,
      },
    ];
  });
}

function displayPanes(panes: Panes | undefined, forming: BbSparkline15mBar | undefined): Panes {
  const base = panes ?? emptyPanes;
  return { ...base, "1m": mergeFormingMinute(base["1m"], forming, new Date()) };
}

function chart(symbol: string, which: Frame, bars: BbSparkline15mBar[]): BbSparkline15m {
  return { symbol, timeframe: which, bbPeriod: 20, bars };
}

function freshnessNote(
  freshness: "fresh" | "stale" | "missing" | null | undefined,
): string | null {
  if (freshness === "stale") return "Stale · not this cycle";
  if (freshness === "missing") return "Missing · no Schwab pane";
  return null;
}

function ThumbPane({
  symbol,
  which,
  bars,
  entryAt,
  entrySide,
  breakoutLevel,
  priceLine,
  axis,
  showAlarmMarks = true,
  timeMarksEvery,
  caption,
}: {
  symbol: string;
  which: Frame;
  bars: BbSparkline15mBar[];
  entryAt?: string | null;
  entrySide?: "CALL" | "PUT" | null;
  breakoutLevel?: number | null;
  priceLine?: number | null;
  axis?: boolean;
  showAlarmMarks?: boolean;
  timeMarksEvery?: number;
  caption?: string;
}) {
  const label = caption ?? (which === "5m" ? "5m · 2h" : which === "1m" ? "1m · 1h" : "15m · 1d");
  return (
    <div className="relative h-full min-h-0 min-w-0">
      <PaneLabel>{label}</PaneLabel>
      <BbSparkline15mChart
        data={chart(symbol, which, bars)}
        entryAt={entryAt}
        entrySide={entrySide}
        breakoutLevel={breakoutLevel}
        priceLine={priceLine}
        variant="thumb"
        axis={axis}
        showEmaEvents
        showAlarmMarks={showAlarmMarks}
        timeMarksEvery={timeMarksEvery}
        fillPane
        className="h-full"
      />
    </div>
  );
}

function PaneLabel({ children }: { children: string }) {
  return (
    <span className="pointer-events-none absolute top-0.5 left-0.5 z-20 inline-flex items-center rounded bg-ocean-deep/80 px-1 py-px text-[8px] font-semibold text-ocean-foam">
      {children}
    </span>
  );
}

export function handoffBars(
  previous: BbSparkline15mBar[] | undefined,
  incoming: BbSparkline15mBar[],
): BbSparkline15mBar[] {
  if (!previous || previous.length === 0) return incoming;
  if (incoming.length === 0) return previous;
  const firstNext = incoming[0]?.datetime ?? "";
  const firstPrev = previous[0]?.datetime ?? "";
  if (firstNext > firstPrev && incoming.length < previous.length) {
    const earlier = previous.filter((bar) => bar.datetime < firstNext);
    if (earlier.length > 0) return [...earlier, ...incoming];
  }
  return incoming;
}

function regularSessionStarted(bars: BbSparkline15mBar[], now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const day = `${value("year")}-${value("month")}-${value("day")}`;
  return bars.some((bar) => bar.datetime >= `${day} 09:30:00`);
}

function useSnapshot(
  refreshKey: number,
  live: boolean,
  enabled: boolean,
): { snapshot: Snapshot | null; error: string | null } {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancel = false;
    let timer = 0;
    const load = () => {
      void fetchBoardSnapshot(refreshKey > 0 && !live, live)
        .then((body) => {
          if (cancel) return;
          const incoming: Snapshot["bySymbol"] = {};
          for (const [symbol, row] of Object.entries(body.symbols ?? {})) {
            incoming[symbol] = {
              error: row.error,
              entryAt: row.entryAt,
              entrySide: row.entrySide,
              breakoutLevel: row.breakoutLevel,
              premarketPrice:
                typeof row.premarketPrice === "number" && Number.isFinite(row.premarketPrice)
                  ? row.premarketPrice
                  : null,
              hourRelation: textOrNull(row.hourRelation),
              hourRegime: textOrNull(row.hourRegime),
              sectorEtf: textOrNull(row.sectorEtf),
              etfMatch: row.etfMatch === true ? true : row.etfMatch === false ? false : null,
              sentiment: row.sentiment === "bull S" || row.sentiment === "bear S" ? row.sentiment : null,
              note: freshnessNote(row.freshness),
              panes: {
                "5m": asBars(row.panes?.["5m"]),
                "15m": asBars(row.panes?.["15m"]),
                "1m": asBars(row.panes?.["1m"]),
              },
            };
          }
          setSnapshot((current) => {
            const bySymbol: Snapshot["bySymbol"] = { ...(current?.bySymbol ?? {}) };
            for (const [symbol, row] of Object.entries(incoming)) {
              const prior = current?.bySymbol[symbol];
              const panes = {
                "5m": handoffBars(prior?.panes["5m"], row.panes["5m"]),
                "15m": handoffBars(prior?.panes["15m"], row.panes["15m"]),
                "1m": handoffBars(prior?.panes["1m"], row.panes["1m"]),
              };
              const opened = regularSessionStarted(panes["5m"]);
              bySymbol[symbol] = {
                ...row,
                panes,
                premarketPrice: opened ? null : (row.premarketPrice ?? prior?.premarketPrice ?? null),
              };
            }
            return {
              label:
                body.uniform === false && body.source === "schwab"
                  ? "Schwab · each ticker on its own cycle"
                  : body.label,
              windowStartEt: body.windowStartEt,
              windowEndEt: body.windowEndEt,
              bySymbol,
            };
          });
          setError(null);
        })
        .catch((err: unknown) => {
          if (!cancel) setError(err instanceof Error ? err.message : "Snapshot failed.");
        });
    };
    load();
    if (live) timer = window.setInterval(load, 30_000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [refreshKey, live, enabled]);
  return { snapshot, error };
}

function useFormingMinutes(symbols: string[], enabled: boolean): Record<string, BbSparkline15mBar> {
  const [bars, setBars] = useState<Record<string, BbSparkline15mBar>>({});
  const key = symbols.join(",");
  useEffect(() => {
    const list = key ? key.split(",") : [];
    if (!enabled || list.length === 0) return;
    let cancel = false;
    let timer = 0;
    const tick = () => {
      const delay = nextFormingDelayMs(new Date());
      const wait = delay ?? 60_000;
      if (delay != null) {
        void loadAlpacaSession()
          .then((session) => {
            if (cancel || !session) return null;
            return fetchFormingMinutes(list, session);
          })
          .then((next) => {
            if (!cancel && next) setBars(next);
          })
          .catch(() => {});
      }
      timer = window.setTimeout(tick, wait);
    };
    tick();
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, [enabled, key]);
  return enabled && nextFormingDelayMs(new Date()) != null ? bars : {};
}

export function TickerThumb({
  symbol,
  panes,
  error,
  entryAt,
  entrySide,
  breakoutLevel,
  premarketPrice = null,
  hourRelation,
  hourRegime,
  sectorEtf = null,
  etfMatch = null,
  sentiment = null,
  transitionCandle = false,
  lateralTrend = false,
  pauseAction = null,
  note,
  frame = "all",
  canMoveEarlier = false,
  canMoveLater = false,
  onMove,
  alertTags = [],
  etfMoves = {},
  angleMarks = [],
  fit = false,
}: {
  symbol: string;
  name?: string;
  panes: Panes;
  error?: string | null;
  entryAt?: string | null;
  entrySide?: "CALL" | "PUT" | null;
  breakoutLevel?: number | null;
  premarketPrice?: number | null;
  hourRelation?: string | null;
  hourRegime?: string | null;
  sectorEtf?: string | null;
  etfMatch?: boolean | null;
  sentiment?: "bull S" | "bear S" | null;
  transitionCandle?: boolean;
  lateralTrend?: boolean;
  pauseAction?: string | null;
  note?: string | null;
  frame?: PaneFilter;
  canMoveEarlier?: boolean;
  canMoveLater?: boolean;
  onMove?: (direction: -1 | 1) => void;
  alertTags?: Array<AlarmStripTag & { colorIndex: number }>;
  etfMoves?: Record<string, 1 | -1 | null>;
  angleMarks?: AngleMark[];
  fit?: boolean;
}) {
  const etfResult = etfComparison(symbol, panes["5m"], etfMoves, sectorEtf, etfMatch);
  const five = panes["5m"].slice(-TWO_HOURS_5M_BARS);
  const oneMinuteCount = frame === "1m" ? SOLO_1M_BARS : ALL_1M_BARS;
  const relation = textOrNull(hourRelation);
  const regime = textOrNull(hourRegime);
  const pane = (which: Frame) => (
    <ThumbPane
      symbol={symbol}
      which={which}
      bars={
        which === "5m"
          ? five
          : which === "1m"
            ? panes["1m"].slice(-oneMinuteCount)
            : panes["15m"].slice(-SESSION_15M_BARS)
      }
      caption={which === "1m" && frame === "1m" ? "1m · 30m" : undefined}
      entryAt={which === "5m" || (which === "15m" && frame !== "all") ? entryAt : null}
      entrySide={which === "5m" || (which === "15m" && frame !== "all") ? entrySide : null}
      breakoutLevel={which === "15m" && frame !== "all" ? breakoutLevel : null}
      priceLine={which === "5m" ? premarketPrice : null}
      showAlarmMarks={which !== "15m" || frame !== "all"}
      axis={which === "5m"}
      timeMarksEvery={frame === "1m" ? 5 : frame === "5m" ? 15 : frame === "15m" ? 60 : undefined}
    />
  );
  return (
    <article
      className={cn(
        "rounded-md border border-ocean-mid/40 bg-ocean-deep/30 p-1",
        fit && "flex h-full min-h-0 flex-col overflow-hidden",
      )}
    >
      <div className={cn("mb-0.5 flex items-start justify-between gap-1", fit && "shrink-0")}>
        <p className="flex min-w-0 flex-nowrap items-center gap-x-1 overflow-hidden font-display text-xs font-semibold text-ocean-foam">
          {onMove ? (
            <button
              type="button"
              aria-label={`Move ${symbol} to the previous cell`}
              disabled={!canMoveEarlier}
              className="shrink-0 px-0.5 text-[11px] leading-none text-ocean-sand disabled:opacity-30"
              onClick={() => onMove(-1)}
            >
              ‹
            </button>
          ) : null}
          <TickerMark symbol={symbol} />
          <span className="shrink-0">{symbol}</span>
          {angleMarks.map((mark) => (
            <AngleBadge key={`${mark.frame}-${mark.tone}`} mark={mark} />
          ))}
          {etfResult ? (
            <span
              className={cn(
                "shrink-0 text-[9px] font-semibold",
                etfResult.match ? "text-ocean-teal" : "text-ocean-danger",
              )}
            >
              {etfResult.etf} {etfResult.match ? "match" : "not"}
            </span>
          ) : null}
          {sentiment === "bull S" ? (
            <span className="shrink-0 text-[9px] font-semibold text-ocean-teal">bull S</span>
          ) : null}
          {sentiment === "bear S" ? (
            <span className="shrink-0 text-[9px] font-semibold text-ocean-danger">bear S</span>
          ) : null}
          {onMove ? (
            <button
              type="button"
              aria-label={`Move ${symbol} to the next cell`}
              disabled={!canMoveLater}
              className="shrink-0 px-0.5 text-[11px] leading-none text-ocean-sand disabled:opacity-30"
              onClick={() => onMove(1)}
            >
              ›
            </button>
          ) : null}
        </p>
        {relation || regime ? (
          <div className="min-w-0 text-right">
            {relation ? <p className={relationClass(relation)}>{relation.replaceAll("_", " ")}</p> : null}
            {regime ? (
              <p className="truncate text-[9px] uppercase tracking-wide text-ocean-sand">
                1h {regime.replaceAll("_", " ")}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {alertTags.length > 0 ? (
        <div className="mb-0.5 flex flex-wrap gap-1">
          {alertTags.map((tag) => (
            <AlarmSignalTag key={tag.id} tag={tag} index={tag.colorIndex} />
          ))}
        </div>
      ) : null}
      {frame === "all" ? (
        <div
          className={cn(
            "grid grid-rows-[3fr_2fr] gap-0.5 overflow-hidden rounded-md border border-ocean-mid/30 bg-ocean-surface/40 p-0.5",
            fit ? "min-h-0 flex-1" : "h-[248px]",
          )}
        >
          {pane("5m")}
          <div className="grid min-h-0 grid-cols-[15fr_8fr] gap-1">
            {pane("1m")}
            {pane("15m")}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "flex w-full items-center justify-center overflow-hidden rounded-md border border-ocean-mid/30 bg-ocean-surface/40 p-0.5 [container-type:size]",
            fit ? "min-h-0 flex-1" : "aspect-[2/1] min-h-[240px]",
          )}
        >
          <div className="min-h-0 min-w-0" style={soloPaneBox(SOLO_PANE_ASPECT[frame])}>
            {pane(frame)}
          </div>
        </div>
      )}
      {pauseAction || transitionCandle || lateralTrend ? (
        <p
          className={cn(
            "mt-0.5 text-[9px] font-semibold",
            pauseAction === "exit"
              ? "text-ocean-danger"
              : pauseAction === "continuation"
                ? "text-ocean-teal"
                : "text-amber-300",
          )}
        >
          {pauseAction === "hold"
            ? "Hold"
            : pauseAction === "continuation"
              ? "Continuation watch"
              : pauseAction === "exit"
                ? "Exit"
                : ""}
          {pauseAction && (transitionCandle || lateralTrend) ? " · " : ""}
          {transitionCandle ? "1m transition" : ""}
          {transitionCandle && lateralTrend ? " · " : ""}
          {lateralTrend ? "5m lateral" : ""}
        </p>
      ) : null}
      {note ? <p className="mt-0.5 text-[9px] text-ocean-foam">{note}</p> : null}
      {error ? <p className="mt-0.5 text-[9px] text-ocean-danger">{error}</p> : null}
      {fit ? null : (
      <p className="mt-0.5 flex flex-wrap gap-x-2 text-[8px] text-ocean-sand">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0.5 w-2.5 rounded-sm bg-sky-400" />
          EMA 10
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0.5 w-2.5 rounded-sm bg-orange-400" />
          EMA 21
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-200" />
          touch
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0 w-0 border-x-[3px] border-b-[5px] border-x-transparent border-b-emerald-400" />
          cross
        </span>
      </p>
      )}
    </article>
  );
}

function useHourContext(
  refreshKey: number,
  enabled: boolean,
): Record<
  string,
  {
    hourRelation: string | null;
    hourRegime: string | null;
    transitionCandle: boolean;
    lateralTrend: boolean;
    pauseAction: string | null;
  }
> {
  const [bySymbol, setBySymbol] = useState<
    Record<
      string,
      {
        hourRelation: string | null;
        hourRegime: string | null;
        transitionCandle: boolean;
        lateralTrend: boolean;
        pauseAction: string | null;
      }
    >
  >({});
  useEffect(() => {
    if (!enabled) return;
    let cancel = false;
    void fetchMovementWatchResults()
      .then((body) => {
        if (cancel) return;
        const next: Record<
          string,
          {
            hourRelation: string | null;
            hourRegime: string | null;
            transitionCandle: boolean;
            lateralTrend: boolean;
            pauseAction: string | null;
          }
        > = {};
        for (const row of body.results ?? []) {
          const symbol = textOrNull(row.symbol)?.toUpperCase();
          if (!symbol) continue;
          next[symbol] = {
            hourRelation: textOrNull(row.hourRelation),
            hourRegime: textOrNull(row.hourRegime),
            transitionCandle: row.transitionCandle === true,
            lateralTrend: row.lateralTrend === true,
            pauseAction: textOrNull(row.pauseAction),
          };
        }
        setBySymbol(next);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [refreshKey, enabled]);
  return bySymbol;
}

export function ActiveTickerBoard({
  tickers,
  refreshKey,
  live = false,
  review = null,
  alertTags = [],
  frame: frameProp,
  onFrameChange,
  showFrameFilters = true,
  showAngleLeaders = true,
  fitViewport = false,
}: {
  tickers: Array<{ symbol: string; name?: string }>;
  refreshKey: number;
  live?: boolean;
  review?: Snapshot | null;
  alertTags?: AlarmStripTag[];
  frame?: ThumbnailFrame;
  onFrameChange?: (frame: ThumbnailFrame) => void;
  showFrameFilters?: boolean;
  showAngleLeaders?: boolean;
  fitViewport?: boolean;
}) {
  const [uncontrolledFrame, setUncontrolledFrame] = useState<PaneFilter>("all");
  const frame = frameProp ?? uncontrolledFrame;
  const setFrame = (next: ThumbnailFrame) => {
    onFrameChange?.(next);
    if (frameProp === undefined) setUncontrolledFrame(next);
  };
  const frameRef = useRef<HTMLDivElement>(null);
  const [paneSize, setPaneSize] = useState({ width: 0, height: 0 });
  const [order, setOrder] = useState<string[]>(() => readThumbOrder());
  const showingReview = review != null;
  const { snapshot: loaded, error } = useSnapshot(refreshKey, live, !showingReview);
  const snapshot = review ?? loaded;
  const forming = useFormingMinutes(
    tickers.map((ticker) => ticker.symbol.trim().toUpperCase()).filter(Boolean),
    live && !showingReview,
  );
  const hourBySymbol = useHourContext(refreshKey, !showingReview);
  useEffect(() => {
    const sync = () => setOrder(readThumbOrder());
    globalThis.addEventListener("storage", sync);
    globalThis.addEventListener(THUMB_ORDER_EVENT, sync);
    return () => {
      globalThis.removeEventListener("storage", sync);
      globalThis.removeEventListener(THUMB_ORDER_EVENT, sync);
    };
  }, []);
  const etfMoves = useEtfMoves(!showingReview);
  useEffect(() => {
    if (!fitViewport) return;
    const node = frameRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      setPaneSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [fitViewport, tickers.length]);
  const arranged = arrangeTickers(tickers, order);
  const moveTicker = (symbol: string, direction: -1 | 1) => {
    const symbols = arranged.map((ticker) => ticker.symbol.toUpperCase());
    const index = symbols.indexOf(symbol.toUpperCase());
    const next = index + direction;
    if (index < 0 || next < 0 || next >= symbols.length) return;
    const swapped = [...symbols];
    const current = swapped[index];
    const neighbor = swapped[next];
    if (!current || !neighbor) return;
    swapped[next] = current;
    swapped[index] = neighbor;
    setOrder(swapped);
    writeThumbOrder(swapped);
  };
  if (tickers.length === 0) {
    return <p className="text-[11px] text-ocean-sand">No active tickers.</p>;
  }
  const window =
    snapshot?.windowStartEt && snapshot.windowEndEt
      ? `${snapshot.windowStartEt.slice(11, 16)}–${snapshot.windowEndEt.slice(11, 16)} ET`
      : "";
  const leaders = angleLeaders(
    arranged.map((ticker) => ({
      symbol: ticker.symbol,
      panes: visiblePanes(
        displayPanes(snapshot?.bySymbol[ticker.symbol]?.panes, forming[ticker.symbol.trim().toUpperCase()]),
      ),
    })),
  );
  const fit = fitViewport
    ? fitThumbnailGrid(arranged.length, paneSize.width, paneSize.height, THUMB_GAP_PX, frame === "all" ? 1.15 : 1.7)
    : null;
  return (
    <div className={fitViewport ? "flex h-full min-h-0 flex-col gap-1 overflow-hidden" : "space-y-2"}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-ocean-sand">
          {snapshot?.label ?? "Alpaca IEX"}
          {window ? ` · ${window}` : ""}
          {snapshot ? "" : " · loading"}
        </p>
        <div className="flex items-center gap-2">
          {order.length > 0 ? (
            <button
              type="button"
              className="text-[10px] font-semibold text-ocean-sand"
              onClick={() => {
                setOrder([]);
                writeThumbOrder([]);
              }}
            >
              Reset order
            </button>
          ) : null}
          {showFrameFilters ? <ThumbnailFrameFilters frame={frame} onChange={setFrame} /> : null}
        </div>
      </div>
      {error ? (
        <p className="text-[11px] text-ocean-danger" role="alert">
          {error}
        </p>
      ) : null}
      {showAngleLeaders ? <div className="shrink-0"><AngleLeadersBar leaders={leaders} /></div> : null}
      <div ref={frameRef} className={fitViewport ? "relative min-h-0 flex-1 overflow-hidden" : undefined}>
        <div
          className={
            fitViewport ? "absolute inset-0 grid overflow-hidden" : "grid grid-cols-2 gap-1.5 lg:grid-cols-4"
          }
          style={
            fit
              ? {
                  gap: THUMB_GAP_PX,
                  gridTemplateColumns: `repeat(${fit.columns}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${fit.rows}, minmax(0, 1fr))`,
                }
              : undefined
          }
        >
        {arranged.map((ticker, index) => (
          <TickerThumb
            key={ticker.symbol}
            symbol={ticker.symbol}
            name={ticker.name}
            canMoveEarlier={index > 0}
            canMoveLater={index < arranged.length - 1}
            onMove={(direction) => moveTicker(ticker.symbol, direction)}
            fit={fitViewport}
            angleMarks={angleMarksFor(leaders, ticker.symbol)}
            panes={displayPanes(snapshot?.bySymbol[ticker.symbol]?.panes, forming[ticker.symbol.trim().toUpperCase()])}
            error={snapshot?.bySymbol[ticker.symbol]?.error}
            entryAt={snapshot?.bySymbol[ticker.symbol]?.entryAt}
            entrySide={snapshot?.bySymbol[ticker.symbol]?.entrySide}
            breakoutLevel={snapshot?.bySymbol[ticker.symbol]?.breakoutLevel}
            premarketPrice={snapshot?.bySymbol[ticker.symbol]?.premarketPrice}
            hourRelation={
              snapshot?.bySymbol[ticker.symbol]?.hourRelation ?? hourBySymbol[ticker.symbol]?.hourRelation
            }
            hourRegime={
              snapshot?.bySymbol[ticker.symbol]?.hourRegime ?? hourBySymbol[ticker.symbol]?.hourRegime
            }
            sectorEtf={snapshot?.bySymbol[ticker.symbol]?.sectorEtf}
            etfMatch={snapshot?.bySymbol[ticker.symbol]?.etfMatch}
            etfMoves={etfMoves}
            sentiment={snapshot?.bySymbol[ticker.symbol]?.sentiment}
            transitionCandle={hourBySymbol[ticker.symbol]?.transitionCandle === true}
            lateralTrend={hourBySymbol[ticker.symbol]?.lateralTrend === true}
            pauseAction={hourBySymbol[ticker.symbol]?.pauseAction}
            note={snapshot?.bySymbol[ticker.symbol]?.note}
            frame={frame}
            alertTags={alertTags.flatMap((tag) => {
              if (tag.symbol.trim().toUpperCase() !== ticker.symbol.trim().toUpperCase()) return [];
              const colorIndex = alertTags
                .filter((row) => row.lane === tag.lane)
                .findIndex((row) => row.id === tag.id);
              return [{ ...tag, colorIndex: colorIndex < 0 ? 0 : colorIndex }];
            })}
          />
        ))}
        </div>
      </div>
    </div>
  );
}
