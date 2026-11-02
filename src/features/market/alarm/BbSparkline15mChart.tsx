/** Compact SVG candlestick + Bollinger disipadores for Breakout board (≤9 × 15m bars). */

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/shared/lib/cn";
import type { BbSparkline15m } from "./alarm-types";
import {
  ALARM_TRIGGER_LOG_CHANGED_EVENT,
  loadAlarmTriggerLog,
  type AlarmTriggerEntry,
} from "./alarm-trigger-log";

type Variant = "thumb" | "full";

type Props = {
  data: BbSparkline15m | null | undefined;
  breakoutLevel?: number | null;
  /** Detected entry time. An asterisk sits beside that candle's close. Exits are not marked. */
  entryAt?: string | null;
  /** CALL is green. PUT is red. */
  entrySide?: "CALL" | "PUT" | null;
  className?: string;
  /** thumb = compact board pane; full = popup enlarge. */
  variant?: Variant;
  /** portrait matches the movement grid. wide stays on the breakout board. */
  shape?: "wide" | "portrait";
  showLegend?: boolean;
};

const THUMB_5M_BARS = 24;
const FULL_5M_SLOT = 40;

type EntryMark = { at: string; side: "CALL" | "PUT" };

type LogSnap = { tradeDate: string; entries: AlarmTriggerEntry[] };

const emptyLog: LogSnap = { tradeDate: "", entries: [] };
let logSnap: LogSnap = emptyLog;
let logStarted = false;
const logListeners = new Set<(snap: LogSnap) => void>();

function sideOfTrigger(row: AlarmTriggerEntry): "CALL" | "PUT" | null {
  const side = String(row.side || "").toLowerCase();
  if (side === "alcista") return "CALL";
  if (side === "bajista") return "PUT";
  const blob = `${row.way ?? ""} ${row.evidence ?? ""}`.toUpperCase();
  if (/\bCALL\b/.test(blob)) return "CALL";
  if (/\bPUT\b/.test(blob)) return "PUT";
  return null;
}

function refreshEntryLog(): void {
  void loadAlarmTriggerLog("current")
    .then((loaded) => {
      logSnap = {
        tradeDate: (loaded.tradeDate ?? "").slice(0, 10),
        entries: loaded.entries ?? [],
      };
      logListeners.forEach((listener) => listener(logSnap));
    })
    .catch(() => {});
}

function useTodayEntryMarks(symbol: string | undefined): EntryMark[] {
  const [snap, setSnap] = useState(logSnap);
  useEffect(() => {
    logListeners.add(setSnap);
    if (!logStarted) {
      logStarted = true;
      refreshEntryLog();
      window.addEventListener(ALARM_TRIGGER_LOG_CHANGED_EVENT, refreshEntryLog);
      window.setInterval(refreshEntryLog, 20000);
    } else {
      setSnap(logSnap);
    }
    return () => {
      logListeners.delete(setSnap);
    };
  }, []);
  const upper = (symbol ?? "").trim().toUpperCase();
  return useMemo(() => {
    if (!upper) return [];
    const marks: EntryMark[] = [];
    for (const row of snap.entries) {
      if (row.kind !== "enter") continue;
      if (String(row.symbol || "").trim().toUpperCase() !== upper) continue;
      if (snap.tradeDate && (row.tradeDate ?? "").slice(0, 10) !== snap.tradeDate) continue;
      const side = sideOfTrigger(row);
      if (!side || !row.triggeredAt) continue;
      marks.push({ at: row.triggeredAt, side });
    }
    return marks;
  }, [snap, upper]);
}

const SIZE: Record<Variant, { pad: { top: number; right: number; bottom: number; left: number }; w: number; h: number }> =
  {
    thumb: { pad: { top: 6, right: 6, bottom: 14, left: 6 }, w: 240, h: 150 },
    full: { pad: { top: 12, right: 10, bottom: 22, left: 10 }, w: 720, h: 640 },
  };

function epochMs(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const parsed = Date.parse(text.includes("T") ? text : text.replace(" ", "T"));
  return Number.isFinite(parsed) ? parsed : null;
}

/** ET wall-clock minute, so a UTC stamp and an offset stamp land on the same candle. */
function etMinute(value: string): number | null {
  const ms = epochMs(value);
  if (ms == null) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const year = Number(pick("year"));
  const month = Number(pick("month"));
  const day = Number(pick("day"));
  const hour = Number(pick("hour"));
  const minute = Number(pick("minute"));
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  return Date.UTC(year, month - 1, day, hour, minute);
}

function entryCandleIndex(
  bars: BbSparkline15m["bars"],
  entryAt: string | null | undefined,
  timeframe: string | undefined,
): number {
  if (!entryAt) return -1;
  const entry = etMinute(entryAt);
  if (entry == null) return -1;
  const width = (timeframe === "5m" ? 5 : 15) * 60_000;
  let match = -1;
  for (let i = 0; i < bars.length; i++) {
    const open = etMinute(bars[i]?.datetime ?? "");
    if (open == null) continue;
    if (entry >= open && entry <= open + width) match = i;
  }
  if (match >= 0) return match;
  let nearest = -1;
  let gap = Number.POSITIVE_INFINITY;
  for (let i = 0; i < bars.length; i++) {
    const open = etMinute(bars[i]?.datetime ?? "");
    if (open == null) continue;
    const distance = Math.abs(entry - open);
    if (distance < gap) {
      gap = distance;
      nearest = i;
    }
  }
  return gap <= width ? nearest : -1;
}

function timeLabel(iso: string): string {
  const m = /[T ](\d{2}):(\d{2})/.exec(iso);
  if (!m) return "";
  return `${m[1]}:${m[2]}`;
}

function isHourOpen(iso: string): boolean {
  return /[T ]\d{2}:00/.test(iso);
}

function formatPrice(value: number): string {
  return value.toFixed(2);
}

/** Closed polygon between upper and lower disipadores (skip gaps where BB is null). */
type OpenMinutePoint = {
  datetime: string;
  close: number;
  ema10?: number | null;
  ema21?: number | null;
};

function OpenMinutePanel({ points }: { points: OpenMinutePoint[] }) {
  const prices: number[] = [];
  for (const point of points) {
    for (const key of ["close", "ema10", "ema21"] as const) {
      const value = Number(point[key]);
      if (Number.isFinite(value)) prices.push(value);
    }
  }
  if (prices.length < 2) return null;
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const pad = (high - low) * 0.08 || 0.05;
  const yMin = low - pad;
  const yMax = high + pad;
  const yAt = (price: number) => 8 + ((yMax - price) / (yMax - yMin || 1)) * 48;
  const xAt = (index: number) => 2 + (index / Math.max(points.length - 1, 1)) * 96;
  const closeLine = lineThrough(points, "close", xAt, yAt);
  const ema10Line = lineThrough(points, "ema10", xAt, yAt);
  const ema21Line = lineThrough(points, "ema21", xAt, yAt);
  const grid = [0, 1, 2, 3].map((step) => 8 + (48 * step) / 3);
  return (
    <svg
      viewBox="0 0 100 60"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      className="block h-full w-full"
      aria-label="1 minute close, EMA 10 and EMA 21"
    >
      {grid.map((y) => (
        <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#94a3b8" strokeOpacity="0.35" strokeWidth="0.4" />
      ))}
      <text x="2" y="6" fill="#cbd5e1" fontSize="4.5">
        1m
      </text>
      {ema21Line ? (
        <polyline fill="none" points={ema21Line} stroke="#fb923c" strokeWidth="1.1" vectorEffect="non-scaling-stroke" />
      ) : null}
      {ema10Line ? (
        <polyline fill="none" points={ema10Line} stroke="#fbbf24" strokeWidth="1.1" vectorEffect="non-scaling-stroke" />
      ) : null}
      {closeLine ? (
        <polyline fill="none" points={closeLine} stroke="#f8fafc" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
      ) : null}
    </svg>
  );
}

function lineThrough(
  points: OpenMinutePoint[],
  key: "close" | "ema10" | "ema21",
  xAt: (index: number) => number,
  yAt: (price: number) => number,
): string | null {
  const drawn: string[] = [];
  points.forEach((point, index) => {
    const value = Number(point[key]);
    if (!Number.isFinite(value)) return;
    drawn.push(`${xAt(index).toFixed(1)},${yAt(value).toFixed(1)}`);
  });
  return drawn.length >= 2 ? drawn.join(" ") : null;
}

function bbEnvelopePath(
  bars: BbSparkline15m["bars"],
  xCenter: (i: number) => number,
  yScale: (price: number) => number,
): string | null {
  const idxs: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (bars[i].bbUpper != null && bars[i].bbLower != null) idxs.push(i);
  }
  if (idxs.length < 2) return null;
  const top = idxs
    .map((i) => `${xCenter(i).toFixed(1)},${yScale(bars[i].bbUpper as number).toFixed(1)}`)
    .join(" ");
  const bottom = [...idxs]
    .reverse()
    .map((i) => `${xCenter(i).toFixed(1)},${yScale(bars[i].bbLower as number).toFixed(1)}`)
    .join(" ");
  return `${top} ${bottom}`;
}

export function BbSparkline15mChart({
  data,
  breakoutLevel,
  entryAt,
  entrySide,
  className,
  variant = "thumb",
  shape = "wide",
  showLegend,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const positionedRef = useRef<string | null>(null);
  const allBars =
    variant === "full" && data?.timeframe === "5m" && data.sessionBars?.length
      ? data.sessionBars
      : (data?.bars ?? []);
  const bars =
    variant === "thumb" && data?.timeframe === "5m" ? allBars.slice(-THUMB_5M_BARS) : allBars;
  const base = SIZE[variant];
  const frameH =
    variant === "thumb" && shape === "portrait" ? Math.round((base.w * 8) / 7) : base.h;
  const naturalW = base.pad.left + base.pad.right + bars.length * FULL_5M_SLOT;
  const scrollable = variant === "full" && data?.timeframe === "5m" && naturalW > 520;
  const W = scrollable ? base.pad.left + base.pad.right + bars.length * FULL_5M_SLOT : base.w;
  const H = frameH;
  const PAD = base.pad;
  const legend = showLegend ?? variant === "full";
  const strokeBand = variant === "full" ? 2 : 1.25;
  const strokeMid = variant === "full" ? 1.5 : 1;
  const labelSize = variant === "full" ? 11 : 7;
  const loggedMarks = useTodayEntryMarks(data?.symbol);
  const entryMarks = useMemo(() => {
    const marks = [...loggedMarks];
    if (entryAt && (entrySide === "CALL" || entrySide === "PUT")) {
      marks.push({ at: entryAt, side: entrySide });
    }
    return marks;
  }, [loggedMarks, entryAt, entrySide]);
  const focusAt = entryMarks.length > 0 ? entryMarks[entryMarks.length - 1]?.at ?? entryAt : entryAt;

  useEffect(() => {
    if (!scrollable || bars.length === 0) return;
    const key = `${focusAt ?? ""}|${bars[0]?.datetime ?? ""}|${entryMarks.length}`;
    if (positionedRef.current === key) return;
    const place = () => {
      const node = scrollerRef.current;
      if (!node || node.clientWidth <= 0) return false;
      const index = entryCandleIndex(bars, focusAt, data?.timeframe);
      const focus = index >= 0 ? index : bars.length - 1;
      const center = PAD.left + FULL_5M_SLOT * focus + FULL_5M_SLOT / 2;
      node.scrollLeft = Math.max(0, center - node.clientWidth / 2);
      return true;
    };
    if (place()) {
      positionedRef.current = key;
      return;
    }
    const frame = requestAnimationFrame(() => {
      if (place()) positionedRef.current = key;
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollable, bars, focusAt, entryMarks.length, data?.timeframe, PAD.left]);

  if (bars.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-1 items-center justify-center rounded-md border border-dashed border-ocean-mid/25 px-2 py-3 text-center text-[11px] text-ocean-sand/70",
          className,
        )}
      >
        No {data?.timeframe ?? "15m"} bars yet — run a check
      </div>
    );
  }

  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const bbUps = bars.map((b) => b.bbUpper).filter((v): v is number => v != null);
  const bbLows = bars.map((b) => b.bbLower).filter((v): v is number => v != null);
  const ema10s = bars.map((b) => b.ema10).filter((v): v is number => v != null);
  const ema21s = bars.map((b) => b.ema21).filter((v): v is number => v != null);
  let yMin = Math.min(
    ...lows,
    ...(bbLows.length ? bbLows : lows),
    ...(ema10s.length ? ema10s : lows),
    ...(ema21s.length ? ema21s : lows),
  );
  let yMax = Math.max(
    ...highs,
    ...(bbUps.length ? bbUps : highs),
    ...(ema10s.length ? ema10s : highs),
    ...(ema21s.length ? ema21s : highs),
  );
  if (
    typeof breakoutLevel === "number" &&
    Number.isFinite(breakoutLevel) &&
    breakoutLevel > 0
  ) {
    yMin = Math.min(yMin, breakoutLevel);
    yMax = Math.max(yMax, breakoutLevel);
  }
  // Fitting the axis to the band makes every Bollinger look wide, and this
  // card is tall, so a tight band fills the frame. Keep at least 5% of price
  // on the axis. A wider move still expands past that.
  const mid = (yMin + yMax) / 2;
  const span = Math.max(yMax - yMin, 0);
  const window = Math.max(span * 1.12, Math.abs(mid) * 0.05, 0.5);
  yMin = mid - window / 2;
  yMax = mid + window / 2;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const showAxis = shape === "portrait" || variant === "full";
  const priceTicks = Array.from({ length: 5 }, (_, index) => yMax - ((yMax - yMin) * index) / 4);
  const slot = scrollable ? FULL_5M_SLOT : plotW / bars.length;
  const bodyW = Math.max(variant === "full" ? 5 : 2.5, slot * 0.55);

  const yScale = (price: number) =>
    PAD.top + ((yMax - price) / (yMax - yMin || 1)) * plotH;
  const xCenter = (i: number) => PAD.left + slot * i + slot / 2;

  const bbLine = (key: "bbUpper" | "bbMid" | "bbLower" | "ema10" | "ema21") => {
    const pts: string[] = [];
    bars.forEach((b, i) => {
      const v = b[key];
      if (v == null) return;
      pts.push(`${xCenter(i).toFixed(1)},${yScale(v).toFixed(1)}`);
    });
    return pts.length >= 2 ? pts.join(" ") : null;
  };

  const upperPts = bbLine("bbUpper");
  const midPts = bbLine("bbMid");
  const lowerPts = bbLine("bbLower");
  const ema10Pts = bbLine("ema10");
  const ema21Pts = bbLine("ema21");
  const tf = data?.timeframe === "5m" ? "5m" : "15m";
  const envelope = bbEnvelopePath(bars, xCenter, yScale);

  const entryRadius = variant === "full" ? 5.5 : 4;
  const entryByCandle = new Map<number, EntryMark>();
  for (const mark of entryMarks) {
    const index = entryCandleIndex(bars, mark.at, data?.timeframe);
    if (index >= 0) entryByCandle.set(index, mark);
  }
  const placedEntries = [...entryByCandle.entries()].map(([index, mark]) => {
    const bar = bars[index];
    let x = xCenter(index) + bodyW / 2 + entryRadius + 3;
    if (x + entryRadius > W - 2) x = xCenter(index) - bodyW / 2 - entryRadius - 3;
    return { ...mark, index, x, y: yScale(bar?.close ?? bar?.high ?? 0) };
  });
  const lastWithWidth = [...bars].reverse().find((b) => b.bbWidth != null);
  const widthExpanding = bars.some((b) => b.widthExpanding === true);
  const lastWidthExpanding = lastWithWidth?.widthExpanding === true;

  const openPoints = (data?.timeframe === "5m" ? data.open1m : undefined)?.filter(
    (point) => Number.isFinite(Number(point.close)),
  );
  const lastBar = bars[bars.length - 1];
  const lastClose = lastBar?.close;
  const lastUp = typeof lastClose === "number" && typeof lastBar?.open === "number" ? lastClose >= lastBar.open : true;
  return (
    <div className={cn("relative flex min-h-0 w-full min-w-0 max-w-full flex-col gap-0.5", className)}>
      <div className="relative flex min-h-0 w-full min-w-0 flex-1">
      <div
        ref={scrollerRef}
        className={cn(
          "min-w-0 max-w-full flex-1",
          scrollable ? "overflow-x-scroll" : "flex h-full min-h-0 flex-col",
        )}
      >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={scrollable ? W : undefined}
        height={scrollable ? H : undefined}
        className={cn("text-ocean-foam", scrollable ? "block max-w-none shrink-0" : "h-full w-full flex-1")}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${data?.symbol ?? ""} ${tf} price, EMA 10, EMA 21, Bollinger`}
      >
        {showAxis
          ? priceTicks.map((price) => (
              <line
                key={price}
                x1={PAD.left}
                x2={W - PAD.right}
                y1={yScale(price)}
                y2={yScale(price)}
                stroke="#94a3b8"
                strokeOpacity={0.28}
                strokeWidth={0.7}
              />
            ))
          : null}
        {showAxis && typeof lastClose === "number" ? (
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={yScale(lastClose)}
            y2={yScale(lastClose)}
            stroke={lastUp ? "#2dd4bf" : "#fb7185"}
            strokeOpacity={0.9}
            strokeDasharray="4 3"
            strokeWidth={variant === "full" ? 1.1 : 0.8}
          />
        ) : null}
        {envelope ? (
          <polygon
            points={envelope}
            className={
              lastWidthExpanding
                ? "fill-amber-400/25"
                : widthExpanding
                  ? "fill-ocean-teal/20"
                  : "fill-ocean-sand/15"
            }
            stroke="none"
          />
        ) : null}

        {upperPts ? (
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeBand}
            className="text-sky-400/90"
            points={upperPts}
          />
        ) : null}
        {midPts ? (
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeMid}
            strokeDasharray="3 2"
            className="text-ocean-teal/80"
            points={midPts}
          />
        ) : null}
        {lowerPts ? (
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeBand}
            className="text-violet-400/90"
            points={lowerPts}
          />
        ) : null}
        {ema21Pts ? (
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeBand}
            className="text-rose-300"
            points={ema21Pts}
          />
        ) : null}
        {ema10Pts ? (
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeBand}
            className="text-amber-300"
            points={ema10Pts}
          />
        ) : null}

        {bars.map((b, i) =>
          isHourOpen(b.datetime) ? (
            <line
              key={`hour-${b.datetime || i}`}
              x1={xCenter(i)}
              x2={xCenter(i)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="#94a3b8"
              strokeOpacity={0.7}
              strokeWidth={variant === "full" ? 1.25 : 0.9}
              strokeDasharray={variant === "full" ? "5 4" : "3 2"}
            />
          ) : null,
        )}

        {typeof breakoutLevel === "number" && Number.isFinite(breakoutLevel) ? (
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={yScale(breakoutLevel)}
            y2={yScale(breakoutLevel)}
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="2 2"
            className="text-amber-500/70"
          />
        ) : null}

        {bars.map((b, i) => {
          const xc = xCenter(i);
          const yO = yScale(b.open);
          const yC = yScale(b.close);
          const yH = yScale(b.high);
          const yL = yScale(b.low);
          const bull = b.close >= b.open;
          const bodyTop = Math.min(yO, yC);
          const bodyH = Math.max(1.5, Math.abs(yC - yO));
          const forming = Boolean(b.forming);
          const onHour = isHourOpen(b.datetime);
          const showTime = onHour
            ? true
            : scrollable
              ? i === bars.length - 1 || i % 6 === 0
              : variant === "full"
                ? i === 0 || i === bars.length - 1 || i === Math.floor(bars.length / 2)
                : i === 0 || i === bars.length - 1;
          return (
            <g key={b.datetime || i}>
              <line
                x1={xc}
                x2={xc}
                y1={yH}
                y2={yL}
                stroke="currentColor"
                strokeWidth={1}
                className={bull ? "text-ocean-teal" : "text-ocean-danger"}
              />
              <rect
                x={xc - bodyW / 2}
                y={bodyTop}
                width={bodyW}
                height={bodyH}
                fill="currentColor"
                className={bull ? "text-ocean-teal" : "text-ocean-danger"}
                stroke={forming ? "currentColor" : undefined}
                strokeWidth={forming ? 1.25 : 0}
                strokeOpacity={forming ? 0.9 : undefined}
              />
              {showTime ? (
                <text
                  x={xc}
                  y={H - 2}
                  textAnchor="middle"
                  className={onHour ? "fill-slate-400" : "fill-ocean-sand/80"}
                  style={{ fontSize: onHour ? labelSize + 1 : labelSize, fontWeight: onHour ? 700 : 400 }}
                >
                  {forming ? "now" : timeLabel(b.datetime)}
                </text>
              ) : null}
            </g>
          );
        })}
        {placedEntries.map((mark) => {
          const color = mark.side === "CALL" ? "#22c55e" : "#ef4444";
          const width = variant === "full" ? 1.5 : 1.25;
          return (
            <g key={`${mark.side}-${mark.at}`}>
              {[0, 45, 90, 135].map((deg) => {
                const rad = (deg * Math.PI) / 180;
                const dx = Math.cos(rad) * entryRadius;
                const dy = Math.sin(rad) * entryRadius;
                return (
                  <g key={deg}>
                    <line
                      x1={mark.x - dx}
                      y1={mark.y - dy}
                      x2={mark.x + dx}
                      y2={mark.y + dy}
                      stroke="#071018"
                      strokeWidth={width + 0.7}
                      strokeLinecap="round"
                    />
                    <line
                      x1={mark.x - dx}
                      y1={mark.y - dy}
                      x2={mark.x + dx}
                      y2={mark.y + dy}
                      stroke={color}
                      strokeWidth={width}
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}
              <title>{mark.side === "CALL" ? "Call entry" : "Put entry"}</title>
            </g>
          );
        })}
      </svg>
      </div>
      {showAxis ? (
        <div className={cn("relative shrink-0", variant === "full" ? "w-14" : "w-9")}>
          <div
            className="absolute inset-x-0 flex flex-col justify-between text-right"
            style={{ top: `${(PAD.top / H) * 100}%`, bottom: `${(PAD.bottom / H) * 100}%` }}
          >
            {priceTicks.map((price) => (
              <span
                key={price}
                className={cn(
                  "tabular-nums text-ocean-sand/80",
                  variant === "full" ? "text-[11px]" : "text-[8px] leading-none",
                )}
              >
                {formatPrice(price)}
              </span>
            ))}
          </div>
          {typeof lastClose === "number" ? (
            <span
              className={cn(
                "absolute right-0 -translate-y-1/2 rounded px-0.5 font-semibold tabular-nums",
                variant === "full" ? "text-[11px]" : "text-[8px] leading-none",
                lastUp ? "bg-teal-400 text-ocean-deep" : "bg-rose-400 text-ocean-deep",
              )}
              style={{ top: `${(yScale(lastClose) / H) * 100}%` }}
            >
              {formatPrice(lastClose)}
            </span>
          ) : null}
        </div>
      ) : null}
      </div>
      {openPoints && openPoints.length >= 2 ? (
        <div
          className={cn(
            "pointer-events-none absolute top-1 left-1 z-20 overflow-hidden rounded border border-slate-500/80 bg-[#1c1c1c]",
            variant === "full" ? "h-32 w-52" : "h-16 w-28",
          )}
        >
          <OpenMinutePanel points={openPoints} />
        </div>
      ) : null}
      {legend ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-0.5 text-[9px] leading-tight text-ocean-sand/85">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-2.5 rounded-sm bg-sky-400/90" />
            upper
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-px w-2.5 border-t border-dashed border-ocean-teal/80" />
            mid
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-2.5 rounded-sm bg-violet-400/90" />
            lower
          </span>
          {ema10Pts ? (
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-0.5 w-2.5 rounded-sm bg-amber-300" />
              EMA 10
            </span>
          ) : null}
          {ema21Pts ? (
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-0.5 w-2.5 rounded-sm bg-rose-300" />
              EMA 21
            </span>
          ) : null}
          {lastWidthExpanding ? (
            <span className="font-medium text-amber-400/95">vol expanding</span>
          ) : bbUps.length < 2 ? (
            <span className="text-ocean-sand/60">BB pending (need history)</span>
          ) : null}
        </div>
      ) : lastWidthExpanding ? (
        <p className="px-0.5 text-[9px] font-medium text-amber-400/95">vol expanding</p>
      ) : null}
    </div>
  );
}
