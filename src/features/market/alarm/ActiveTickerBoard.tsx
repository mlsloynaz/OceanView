import { useEffect, useState } from "react";
import { BbSparkline15mChart } from "./BbSparkline15mChart";
import type { BbSparkline15m, BbSparkline15mBar } from "./alarm-types";

type Frame = "5m" | "15m" | "1m";

type Candle = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  ema10?: number | null;
  ema21?: number | null;
};

const cache = new Map<string, BbSparkline15mBar[]>();

function toBars(body: unknown, limit: number): BbSparkline15mBar[] {
  if (!Array.isArray(body)) return [];
  const bars = body.flatMap((point) => {
    if (!point || typeof point !== "object") return [];
    const row = point as Partial<Candle>;
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
        bbUpper: null,
        bbMid: null,
        bbLower: null,
        ema10: row.ema10 ?? null,
        ema21: row.ema21 ?? null,
      },
    ];
  });
  return bars.slice(-limit);
}

function loadFrame(symbol: string, frame: Frame, fresh: boolean): Promise<BbSparkline15mBar[]> {
  const key = `${symbol}|${frame}`;
  const limit = frame === "1m" ? 36 : frame === "15m" ? 26 : 48;
  const url = `/dev/minute-line?symbol=${encodeURIComponent(symbol)}&interval=${frame}${fresh ? "&fresh=1" : ""}`;
  return fetch(url)
    .then((response) => (response.ok ? response.json() : []))
    .then((body: unknown) => {
      const bars = toBars(body, limit);
      cache.set(key, bars);
      return bars;
    })
    .catch(() => cache.get(key) ?? []);
}

function useFrame(symbol: string, frame: Frame, refreshKey: number): BbSparkline15mBar[] {
  const key = `${symbol}|${frame}`;
  const [bars, setBars] = useState<BbSparkline15mBar[]>(() => cache.get(key) ?? []);
  useEffect(() => {
    let cancel = false;
    void loadFrame(symbol, frame, refreshKey > 0).then((next) => {
      if (!cancel) setBars(next);
    });
    return () => {
      cancel = true;
    };
  }, [symbol, frame, refreshKey]);
  return bars;
}

function chart(symbol: string, bars: BbSparkline15mBar[]): BbSparkline15m {
  return { symbol, timeframe: "15m", bbPeriod: 20, bars };
}

function PaneLabel({ children }: { children: string }) {
  return (
    <span className="pointer-events-none absolute top-0.5 left-0.5 z-20 rounded bg-ocean-deep/80 px-1 py-px text-[8px] font-semibold text-ocean-foam">
      {children}
    </span>
  );
}

export function TickerThumb({
  symbol,
  name,
  refreshKey,
}: {
  symbol: string;
  name?: string;
  refreshKey: number;
}) {
  const five = useFrame(symbol, "5m", refreshKey);
  const fifteen = useFrame(symbol, "15m", refreshKey);
  const one = useFrame(symbol, "1m", refreshKey);
  const panes: Record<Frame, BbSparkline15mBar[]> = { "5m": five, "15m": fifteen, "1m": one };

  return (
    <article className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/30 p-2">
      <p className="mb-1 truncate font-display text-sm font-semibold text-ocean-foam">
        {symbol}
        {name ? <span className="ml-1 text-[10px] font-normal text-ocean-sand">{name}</span> : null}
      </p>
      <div className="grid aspect-[16/10] grid-cols-[1.7fr_1fr] grid-rows-2 gap-1 overflow-hidden rounded-md border border-ocean-mid/30 bg-ocean-surface/40 p-1">
        <div className="relative row-span-2 min-h-0 min-w-0">
          <PaneLabel>5m</PaneLabel>
          <BbSparkline15mChart data={chart(symbol, panes["5m"])} variant="thumb" axis className="h-full" />
        </div>
        <div className="relative min-h-0 min-w-0">
          <PaneLabel>15m</PaneLabel>
          <BbSparkline15mChart data={chart(symbol, panes["15m"])} variant="thumb" axis miniScale className="h-full" />
        </div>
        <div className="relative min-h-0 min-w-0">
          <PaneLabel>1m</PaneLabel>
          <BbSparkline15mChart data={chart(symbol, panes["1m"])} variant="thumb" axis miniScale className="h-full" />
        </div>
      </div>
      <p className="mt-1 flex flex-wrap gap-x-2 text-[9px] text-ocean-sand">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0.5 w-2.5 rounded-sm bg-amber-300" />
          EMA 10
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0.5 w-2.5 rounded-sm bg-rose-300" />
          EMA 21
        </span>
      </p>
    </article>
  );
}

export function ActiveTickerBoard({
  tickers,
  refreshKey,
}: {
  tickers: Array<{ symbol: string; name?: string }>;
  refreshKey: number;
}) {
  if (tickers.length === 0) {
    return <p className="text-[11px] text-ocean-sand">No active tickers.</p>;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {tickers.map((ticker) => (
        <TickerThumb
          key={ticker.symbol}
          symbol={ticker.symbol}
          name={ticker.name}
          refreshKey={refreshKey}
        />
      ))}
    </div>
  );
}
