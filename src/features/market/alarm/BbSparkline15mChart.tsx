/** Compact SVG candlestick + Bollinger bands for Breakout board (≤9 × 15m bars). */

import { cn } from "@/shared/lib/cn";
import type { BbSparkline15m } from "./alarm-types";

type Props = {
  data: BbSparkline15m | null | undefined;
  breakoutLevel?: number | null;
  className?: string;
};

const PAD = { top: 8, right: 6, bottom: 16, left: 6 };
const W = 220;
const H = 140;

function timeLabel(iso: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return "";
  return `${m[1]}:${m[2]}`;
}

export function BbSparkline15mChart({ data, breakoutLevel, className }: Props) {
  const bars = data?.bars ?? [];
  if (bars.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-1 items-center justify-center rounded-md border border-dashed border-ocean-mid/25 px-2 py-4 text-center text-[11px] text-ocean-sand/70",
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
  const bodyW = Math.max(3, slot * 0.55);

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

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label={`${data?.symbol ?? ""} 15m Bollinger sparkline`}
    >
      {upperPts ? (
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          className="text-ocean-sand/50"
          points={upperPts}
        />
      ) : null}
      {midPts ? (
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray="3 2"
          className="text-ocean-teal/70"
          points={midPts}
        />
      ) : null}
      {lowerPts ? (
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          className="text-ocean-sand/50"
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
            {i === 0 || i === bars.length - 1 || i === Math.floor(bars.length / 2) ? (
              <text
                x={xc}
                y={H - 3}
                textAnchor="middle"
                className="fill-ocean-sand/80"
                style={{ fontSize: 8 }}
              >
                {timeLabel(b.datetime)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
