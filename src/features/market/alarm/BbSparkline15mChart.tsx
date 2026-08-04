/** Compact SVG candlestick + Bollinger disipadores for Breakout board (≤9 × 15m bars). */

import { cn } from "@/shared/lib/cn";
import type { BbSparkline15m } from "./alarm-types";

type Variant = "thumb" | "full";

type Props = {
  data: BbSparkline15m | null | undefined;
  breakoutLevel?: number | null;
  className?: string;
  /** thumb = compact board pane; full = popup enlarge. */
  variant?: Variant;
  showLegend?: boolean;
};

const SIZE: Record<Variant, { pad: { top: number; right: number; bottom: number; left: number }; w: number; h: number }> =
  {
    thumb: { pad: { top: 4, right: 4, bottom: 12, left: 4 }, w: 200, h: 72 },
    full: { pad: { top: 12, right: 10, bottom: 22, left: 10 }, w: 640, h: 360 },
  };

function timeLabel(iso: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(iso);
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
  className,
  variant = "thumb",
  showLegend,
}: Props) {
  const bars = data?.bars ?? [];
  const { pad: PAD, w: W, h: H } = SIZE[variant];
  const legend = showLegend ?? variant === "full";
  const strokeBand = variant === "full" ? 2 : 1.25;
  const strokeMid = variant === "full" ? 1.5 : 1;
  const labelSize = variant === "full" ? 11 : 7;

  if (bars.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-1 items-center justify-center rounded-md border border-dashed border-ocean-mid/25 px-2 py-3 text-center text-[11px] text-ocean-sand/70",
          className,
        )}
      >
        No 15m bars yet — run a check
      </div>
    );
  }

  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const bbUps = bars.map((b) => b.bbUpper).filter((v): v is number => v != null);
  const bbLows = bars.map((b) => b.bbLower).filter((v): v is number => v != null);
  let yMin = Math.min(...lows, ...(bbLows.length ? bbLows : lows));
  let yMax = Math.max(...highs, ...(bbUps.length ? bbUps : highs));
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
  const slot = plotW / bars.length;
  const bodyW = Math.max(variant === "full" ? 5 : 2.5, slot * 0.55);

  const yScale = (price: number) =>
    PAD.top + ((yMax - price) / (yMax - yMin || 1)) * plotH;
  const xCenter = (i: number) => PAD.left + slot * i + slot / 2;

  const bbLine = (key: "bbUpper" | "bbMid" | "bbLower") => {
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
  const envelope = bbEnvelopePath(bars, xCenter, yScale);

  const lastWithWidth = [...bars].reverse().find((b) => b.bbWidth != null);
  const widthExpanding = bars.some((b) => b.widthExpanding === true);
  const lastWidthExpanding = lastWithWidth?.widthExpanding === true;

  return (
    <div className={cn("flex min-h-0 flex-col gap-0.5", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-full w-full flex-1 text-ocean-foam"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${data?.symbol ?? ""} 15m Bollinger disipadores`}
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
          const showTime =
            variant === "full"
              ? i === 0 || i === bars.length - 1 || i === Math.floor(bars.length / 2)
              : i === 0 || i === bars.length - 1;
          return (
            <g key={b.datetime || i} opacity={forming ? 0.75 : 1}>
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
                  {timeLabel(b.datetime)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
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
