import { useEffect, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { AlarmSignalTag, type AlarmStripTag } from "./AlarmSignalStrip";
import { TickerMark } from "./TickerMark";
import { BbSparkline15mChart } from "./BbSparkline15mChart";
import { fetchFormingMinutes, loadAlpacaSession, mergeFormingMinute, nextFormingDelayMs } from "./alpaca-forming-minute";
import { fetchBoardSnapshot, fetchMovementWatchResults } from "./alarm-client";
import type { BbSparkline15m, BbSparkline15mBar } from "./alarm-types";

type Frame = "5m" | "15m" | "1m";
type PaneFilter = Frame | "all";

const PANE_FILTERS: Array<{ id: PaneFilter; label: string }> = [
  { id: "1m", label: "1m" },
  { id: "15m", label: "15m" },
  { id: "5m", label: "5m" },
  { id: "all", label: "All" },
];

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
      hourRelation?: string | null;
      hourRegime?: string | null;
      sentiment?: "bull S" | "bear S" | null;
      note?: string | null;
    }
  >;
};

const emptyPanes: Panes = { "5m": [], "15m": [], "1m": [] };
const ALL_1M_BARS = 60;
const SOLO_1M_BARS = 30;
const TWO_HOURS_5M_BARS = 24;
const SESSION_15M_BARS = 26;

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
            hourRelation: textOrNull(row.hourRelation),
            hourRegime: textOrNull(row.hourRegime),
            sentiment: row.sentiment === "bull S" || row.sentiment === "bear S" ? row.sentiment : null,
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
  name,
  panes,
  error,
  entryAt,
  entrySide,
  breakoutLevel,
  hourRelation,
  hourRegime,
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
}: {
  symbol: string;
  name?: string;
  panes: Panes;
  error?: string | null;
  entryAt?: string | null;
  entrySide?: "CALL" | "PUT" | null;
  breakoutLevel?: number | null;
  hourRelation?: string | null;
  hourRegime?: string | null;
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
}) {
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
      showAlarmMarks={which !== "15m" || frame !== "all"}
      axis={which === "5m"}
      timeMarksEvery={frame === "1m" ? 5 : frame === "5m" ? 15 : frame === "15m" ? 60 : undefined}
    />
  );
  return (
    <article className="rounded-md border border-ocean-mid/40 bg-ocean-deep/30 p-1">
      <div className="mb-0.5 flex items-start justify-between gap-1">
        <p className="flex min-w-0 items-center gap-0.5 font-display text-xs font-semibold text-ocean-foam">
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
          <span className="min-w-0 truncate">
            <TickerMark symbol={symbol} />
            {symbol}
            {sentiment === "bull S" ? (
              <span className="ml-1 text-[9px] font-semibold text-ocean-teal">bull S</span>
            ) : null}
            {sentiment === "bear S" ? (
              <span className="ml-1 text-[9px] font-semibold text-ocean-danger">bear S</span>
            ) : null}
            {name ? <span className="ml-1 text-[9px] font-normal text-ocean-sand">{name}</span> : null}
          </span>
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
        <div className="grid h-[248px] grid-rows-[3fr_2fr] gap-0.5 overflow-hidden rounded-md border border-ocean-mid/30 bg-ocean-surface/40 p-0.5">
          {pane("5m")}
          <div className="grid min-h-0 grid-cols-[15fr_8fr] gap-1">
            {pane("1m")}
            {pane("15m")}
          </div>
        </div>
      ) : (
        <div className="aspect-[2/1] min-h-[240px] w-full overflow-hidden rounded-md border border-ocean-mid/30 bg-ocean-surface/40 p-0.5">
          {pane(frame)}
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
}: {
  tickers: Array<{ symbol: string; name?: string }>;
  refreshKey: number;
  live?: boolean;
  review?: Snapshot | null;
  alertTags?: AlarmStripTag[];
}) {
  const [frame, setFrame] = useState<PaneFilter>("all");
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
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <div className="flex gap-1" role="group" aria-label="Thumbnail timeframe">
          {PANE_FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={frame === option.id}
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-semibold",
                frame === option.id
                  ? "bg-ocean-teal text-ocean-deep"
                  : "border border-ocean-mid/40 text-ocean-sand",
              )}
              onClick={() => setFrame(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        </div>
      </div>
      {error ? (
        <p className="text-[11px] text-ocean-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
        {arranged.map((ticker, index) => (
          <TickerThumb
            key={ticker.symbol}
            symbol={ticker.symbol}
            name={ticker.name}
            canMoveEarlier={index > 0}
            canMoveLater={index < arranged.length - 1}
            onMove={(direction) => moveTicker(ticker.symbol, direction)}
            panes={displayPanes(snapshot?.bySymbol[ticker.symbol]?.panes, forming[ticker.symbol.trim().toUpperCase()])}
            error={snapshot?.bySymbol[ticker.symbol]?.error}
            entryAt={snapshot?.bySymbol[ticker.symbol]?.entryAt}
            entrySide={snapshot?.bySymbol[ticker.symbol]?.entrySide}
            breakoutLevel={snapshot?.bySymbol[ticker.symbol]?.breakoutLevel}
            hourRelation={
              snapshot?.bySymbol[ticker.symbol]?.hourRelation ?? hourBySymbol[ticker.symbol]?.hourRelation
            }
            hourRegime={
              snapshot?.bySymbol[ticker.symbol]?.hourRegime ?? hourBySymbol[ticker.symbol]?.hourRegime
            }
            sentiment={snapshot?.bySymbol[ticker.symbol]?.sentiment}
            transitionCandle={hourBySymbol[ticker.symbol]?.transitionCandle === true}
            lateralTrend={hourBySymbol[ticker.symbol]?.lateralTrend === true}
            pauseAction={hourBySymbol[ticker.symbol]?.pauseAction}
            note={snapshot?.bySymbol[ticker.symbol]?.note}
            frame={frame}
            alertTags={alertTags.flatMap((tag, colorIndex) =>
              tag.symbol.trim().toUpperCase() === ticker.symbol.trim().toUpperCase()
                ? [{ ...tag, colorIndex }]
                : [],
            )}
          />
        ))}
      </div>
    </div>
  );
}
