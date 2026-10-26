/** Compact SVG candlestick + Bollinger disipadores for Breakout board (≤9 × 15m bars). */

import { useEffect, useRef } from "react";
import { cn } from "@/shared/lib/cn";
import type { BbSparkline15m } from "./alarm-types";

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
  showLegend?: boolean;
};

const THUMB_5M_BARS = 24;
const FULL_5M_SLOT = 22;

const SIZE: Record<Variant, { pad: { top: number; right: number; bottom: number; left: number }; w: number; h: number }> =
  {
    // ~16:10 — readable candles without the ultra-wide strip look
    thumb: { pad: { top: 6, right: 6, bottom: 14, left: 6 }, w: 240, h: 150 },
    full: { pad: { top: 12, right: 10, bottom: 22, left: 10 }, w: 640, h: 360 },
  };

function epochMs(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const parsed = Date.parse(text.includes("T") ? text : text.replace(" ", "T"));
  return Number.isFinite(parsed) ? parsed : null;
}

function entryCandleIndex(
  bars: BbSparkline15m["bars"],
  entryAt: string | null | undefined,
  timeframe: string | undefined,
): number {
  if (!entryAt) return -1;
  const entry = epochMs(entryAt);
  if (entry == null) return -1;
  const width = (timeframe === "5m" ? 5 : 15) * 60_000;
  let match = -1;
  for (let i = 0; i < bars.length; i++) {
    const open = epochMs(bars[i]?.datetime ?? "");
    if (open == null) continue;
    if (entry >= open && entry < open + width) match = i;
  }
  return match;
}

function timeLabel(iso: string): string {
  const m = /[T ](\d{2}):(\d{2})/.exec(iso);
  if (!m) return "";
  return `${m[1]}:${m[2]}`;
}

/** Closed polygon between upper and lower disipadores (skip gaps where BB is null). */
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
  showLegend,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const positionedRef = useRef<string | null>(null);
  const allBars = data?.bars ?? [];
  const bars =
    variant === "thumb" && data?.timeframe === "5m" ? allBars.slice(-THUMB_5M_BARS) : allBars;
  const base = SIZE[variant];
  const scrollable =
    variant === "full" &&
    data?.timeframe === "5m" &&
    base.pad.left + base.pad.right + bars.length * FULL_5M_SLOT > base.w;
  const W = scrollable ? base.pad.left + base.pad.right + bars.length * FULL_5M_SLOT : base.w;
  const H = base.h;
  const PAD = base.pad;
  const legend = showLegend ?? variant === "full";
  const strokeBand = variant === "full" ? 2 : 1.25;
  const strokeMid = variant === "full" ? 1.5 : 1;
  const labelSize = variant === "full" ? 11 : 7;

  useEffect(() => {
    if (!scrollable || bars.length === 0) return;
    const key = `${entryAt ?? ""}|${bars[0]?.datetime ?? ""}`;
    if (positionedRef.current === key) return;
    const place = () => {
      const node = scrollerRef.current;
      if (!node || node.clientWidth <= 0) return false;
      const index = entryCandleIndex(bars, entryAt, data?.timeframe);
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
  }, [scrollable, bars, entryAt, data?.timeframe, PAD.left]);

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
  const padY = (yMax - yMin) * 0.08 || 0.5;
  yMin -= padY;
  yMax += padY;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
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

  const entryIndex = entryCandleIndex(bars, entryAt, data?.timeframe);
  const entryBar = entryIndex >= 0 ? bars[entryIndex] : null;
  const entryFont = variant === "full" ? 10 : 7;
  const entryMark =
    entryBar && (entrySide === "CALL" || entrySide === "PUT")
      ? {
          x: Math.min(W - 2, xCenter(entryIndex) + bodyW / 2 + 2),
          y: yScale(entryBar.close),
        }
      : null;
  const lastWithWidth = [...bars].reverse().find((b) => b.bbWidth != null);
  const widthExpanding = bars.some((b) => b.widthExpanding === true);
  const lastWidthExpanding = lastWithWidth?.widthExpanding === true;

  return (
    <div className={cn("flex min-h-0 flex-col gap-0.5", className)}>
      <div
        ref={scrollerRef}
        className={cn(
          "w-full min-w-0",
          scrollable ? "overflow-x-auto" : "flex h-full min-h-0 flex-1 flex-col",
        )}
      >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={scrollable ? W : undefined}
        height={scrollable ? H : undefined}
        className={cn("text-ocean-foam", scrollable ? "max-w-none" : "h-full w-full flex-1")}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${data?.symbol ?? ""} ${tf} price, EMA 10, EMA 21, Bollinger`}
      >
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
          const showTime = scrollable
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
                  className="fill-ocean-sand/80"
                  style={{ fontSize: labelSize }}
                >
                  {forming ? "now" : timeLabel(b.datetime)}
                </text>
              ) : null}
            </g>
          );
        })}
        {entryMark ? (
          <text
            x={entryMark.x.toFixed(1)}
            y={entryMark.y.toFixed(1)}
            textAnchor="start"
            dominantBaseline="central"
            fill={entrySide === "CALL" ? "#22c55e" : "#ef4444"}
            fontSize={entryFont}
            fontWeight={700}
          >
            *
            <title>{entrySide === "CALL" ? "Call entry" : "Put entry"}</title>
          </text>
        ) : null}
      </svg>
      </div>
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
