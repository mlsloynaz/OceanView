import { useEffect, useState } from "react";
import { BbSparkline15mChart } from "./BbSparkline15mChart";
import { fetchBoardSnapshot } from "./alarm-client";
import type { BbSparkline15m, BbSparkline15mBar } from "./alarm-types";

type Frame = "5m" | "15m" | "1m";

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
      note?: string | null;
    }
  >;
};

const emptyPanes: Panes = { "5m": [], "15m": [], "1m": [] };
const FIFTEEN_MINUTES_1M = 15;
const TWO_HOURS_5M_BARS = 24;
const TWO_HOURS_15M_BARS = 8;

function quote(bars: BbSparkline15mBar[]): { price: number; change: number; pct: number } | null {
  if (bars.length === 0) return null;
  const first = bars[0];
  const last = bars[bars.length - 1];
  if (!first || !last || !first.open) return null;
  const change = last.close - first.open;
  return { price: last.close, change, pct: (change / first.open) * 100 };
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
      },
    ];
  });
}

function chart(symbol: string, bars: BbSparkline15mBar[]): BbSparkline15m {
  return { symbol, timeframe: "15m", bbPeriod: 20, bars };
}

function freshnessNote(
  freshness: "fresh" | "stale" | "missing" | null | undefined,
): string | null {
  if (freshness === "stale") return "Stale · not this cycle";
  if (freshness === "missing") return "Missing · no Schwab pane";
  return null;
}

function PaneLabel({ children }: { children: string }) {
  return (
    <span className="pointer-events-none absolute top-0.5 left-0.5 z-20 rounded bg-ocean-deep/80 px-1 py-px text-[8px] font-semibold text-ocean-foam">
      {children}
    </span>
  );
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
    void fetchBoardSnapshot(refreshKey > 0 && !live, live)
      .then((body) => {
        if (cancel) return;
        const bySymbol: Snapshot["bySymbol"] = {};
        for (const [symbol, row] of Object.entries(body.symbols ?? {})) {
          bySymbol[symbol] = {
            error: row.error,
            entryAt: row.entryAt,
            entrySide: row.entrySide,
            breakoutLevel: row.breakoutLevel,
            note: freshnessNote(row.freshness),
            panes: {
              "5m": asBars(row.panes?.["5m"]),
              "15m": asBars(row.panes?.["15m"]),
              "1m": asBars(row.panes?.["1m"]),
            },
          };
        }
        setSnapshot({
          label:
            body.uniform === false && body.source === "schwab"
              ? "Schwab · each ticker on its own cycle"
              : body.label,
          windowStartEt: body.windowStartEt,
          windowEndEt: body.windowEndEt,
          bySymbol,
        });
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancel) setError(err instanceof Error ? err.message : "Snapshot failed.");
      });
    return () => {
      cancel = true;
    };
  }, [refreshKey, live, enabled]);
  return { snapshot, error };
}

export function TickerThumb({
  symbol,
  name,
  panes,
  error,
  entryAt,
  entrySide,
  breakoutLevel,
  note,
}: {
  symbol: string;
  name?: string;
  panes: Panes;
  error?: string | null;
  entryAt?: string | null;
  entrySide?: "CALL" | "PUT" | null;
  breakoutLevel?: number | null;
  note?: string | null;
}) {
  const five = panes["5m"].slice(-TWO_HOURS_5M_BARS);
  const quoteRow = quote(five);
  const down = (quoteRow?.change ?? 0) < 0;
  return (
    <article className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/30 p-1.5">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <p className="truncate font-display text-sm font-semibold text-ocean-foam">
          {symbol}
          {name ? <span className="ml-1 text-[10px] font-normal text-ocean-sand">{name}</span> : null}
        </p>
        {quoteRow ? (
          <p className={cnPrice(down)}>
            {quoteRow.price.toFixed(2)}{" "}
            <span className="font-medium">
              {down ? "" : "+"}
              {quoteRow.change.toFixed(2)} ({down ? "" : "+"}
              {quoteRow.pct.toFixed(2)}%)
            </span>
          </p>
        ) : null}
      </div>
      <div className="grid h-[252px] grid-rows-[minmax(0,1fr)_112px] gap-1 overflow-hidden rounded-md border border-ocean-mid/30 bg-ocean-surface/40 p-1">
        <div className="relative min-h-0 min-w-0">
          <PaneLabel>5m · 2h</PaneLabel>
          <BbSparkline15mChart
            data={chart(symbol, five)}
            entryAt={entryAt}
            entrySide={entrySide}
            variant="thumb"
            axis
            showEmaEvents
            className="h-full"
          />
        </div>
        <div className="grid min-h-0 grid-cols-[15fr_8fr] gap-1">
          <div className="relative min-h-0 min-w-0">
            <PaneLabel>1m · 15m</PaneLabel>
            <BbSparkline15mChart
              data={chart(symbol, panes["1m"].slice(-FIFTEEN_MINUTES_1M))}
              variant="thumb"
              showEmaEvents
              frame={{ w: 320, h: 148 }}
              className="h-full"
            />
          </div>
          <div className="relative min-h-0 min-w-0">
            <PaneLabel>15m · 2h</PaneLabel>
            <BbSparkline15mChart
              data={chart(symbol, panes["15m"].slice(-TWO_HOURS_15M_BARS))}
              breakoutLevel={breakoutLevel}
              variant="thumb"
              showEmaEvents
              frame={{ w: 176, h: 148 }}
              className="h-full"
            />
          </div>
        </div>
      </div>
      {note ? <p className="mt-1 text-[10px] text-ocean-foam">{note}</p> : null}
      {error ? <p className="mt-1 text-[10px] text-ocean-danger">{error}</p> : null}
      <p className="mt-1 flex flex-wrap gap-x-2 text-[8px] text-ocean-sand">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0.5 w-2.5 rounded-sm bg-sky-400" />
          EMA 10
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0.5 w-2.5 rounded-sm bg-orange-400" />
          EMA 21
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
          touch
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0 w-0 border-x-[3px] border-b-[5px] border-x-transparent border-b-emerald-400" />
          cross
        </span>
      </p>
    </article>
  );
}

function cnPrice(down: boolean): string {
  return down
    ? "shrink-0 text-[11px] font-semibold tabular-nums text-rose-300"
    : "shrink-0 text-[11px] font-semibold tabular-nums text-emerald-300";
}

export function ActiveTickerBoard({
  tickers,
  refreshKey,
  live = false,
  review = null,
}: {
  tickers: Array<{ symbol: string; name?: string }>;
  refreshKey: number;
  live?: boolean;
  review?: Snapshot | null;
}) {
  const { snapshot: loaded, error } = useSnapshot(refreshKey, live, review == null);
  const snapshot = review ?? loaded;
  if (tickers.length === 0) {
    return <p className="text-[11px] text-ocean-sand">No active tickers.</p>;
  }
  const window =
    snapshot?.windowStartEt && snapshot.windowEndEt
      ? `${snapshot.windowStartEt.slice(11, 16)}–${snapshot.windowEndEt.slice(11, 16)} ET`
      : "";
  return (
    <div className="space-y-2">
      <p className="text-[10px] text-ocean-sand">
        {snapshot?.label ?? "Alpaca IEX"}
        {window ? ` · ${window}` : ""}
        {snapshot ? "" : " · loading"}
      </p>
      {error ? (
        <p className="text-[11px] text-ocean-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {tickers.map((ticker) => (
          <TickerThumb
            key={ticker.symbol}
            symbol={ticker.symbol}
            name={ticker.name}
            panes={snapshot?.bySymbol[ticker.symbol]?.panes ?? emptyPanes}
            error={snapshot?.bySymbol[ticker.symbol]?.error}
            entryAt={snapshot?.bySymbol[ticker.symbol]?.entryAt}
            entrySide={snapshot?.bySymbol[ticker.symbol]?.entrySide}
            breakoutLevel={snapshot?.bySymbol[ticker.symbol]?.breakoutLevel}
            note={snapshot?.bySymbol[ticker.symbol]?.note}
          />
        ))}
      </div>
    </div>
  );
}
