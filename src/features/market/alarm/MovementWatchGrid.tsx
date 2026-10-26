import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { BbSparkline15mChart } from "./BbSparkline15mChart";
import {
  formatAlarmTrend,
  watchRuleKeys,
  type BbSparkline15m,
  type MarketAlarmWatch,
} from "./alarm-types";
import { detectedEntryAt, detectedEntrySide, lastEntryTitle } from "./five-minute-entry";
import { TickerEntriesModal } from "./TickerEntriesModal";
import { THUMB_GAP_PX, fitThumbnailGrid } from "./fit-thumbnail-grid";

const BTN =
  "rounded px-2 py-1 text-[10px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  watches: MarketAlarmWatch[];
  tickerNameBySymbol: Map<string, string>;
  onCheckNow: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRemove: (id: string) => void;
  onConfirmEnter: (id: string) => void;
  onConfirmExit: (id: string) => void;
  onClearMetStatus: (id: string, opts?: { restart?: boolean }) => void;
  onEnlargeChart: (id: string) => void;
  /** Wider layouts for the popped-out grid window. */
  layoutClassName?: string;
  /** Size every graph thumbnail so the set fits the pane, keeping 16:10. */
  fitViewport?: boolean;
};

export function usesFiveMinuteChart(
  watch: Pick<MarketAlarmWatch, "ruleKey" | "ruleKeys">,
): boolean {
  const keys = watchRuleKeys(watch);
  return keys.includes("trend_change_5m") || keys.includes("ema_cross_5m");
}

/** 5m trend and EMA cross use the 5m chart only. Never the 15m ORB sparkline. */
export function chartForWatch(watch: MarketAlarmWatch): BbSparkline15m | null {
  const movement = watch.lastMovementChart ?? null;
  if (usesFiveMinuteChart(watch)) {
    return movement?.timeframe === "5m" ? movement : null;
  }
  if (movement?.bars?.length) return movement;
  if (watch.lastBbSparkline15m?.bars?.length) return watch.lastBbSparkline15m;
  return movement ?? watch.lastBbSparkline15m ?? null;
}

function cardTone(status: MarketAlarmWatch["status"]): string {
  if (status === "met") return "border-ocean-teal/55 bg-ocean-teal/10";
  if (status === "exit") return "border-amber-500/55 bg-amber-500/10";
  if (status === "in_trade") return "border-sky-500/40 bg-sky-500/10";
  if (status === "paused") return "border-ocean-sand/40 bg-ocean-sand/10";
  if (status === "running" || status === "checking") {
    return "border-ocean-mid/40 bg-ocean-surface/50";
  }
  return "border-ocean-mid/30 bg-ocean-deep/20";
}

function clockLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function lastAlarmLine(watch: MarketAlarmWatch): string | null {
  const label = watch.lastAlarmLabel;
  const at = clockLabel(watch.lastAlarmAt);
  if (label && at) return `${label} · ${at}`;
  if (label) return label;
  if (watch.status === "met") {
    const fallback = clockLabel(watch.metAt);
    const name = contractLabel("buy", watch.lastDetectedTrend);
    return fallback ? `${name} · ${fallback}` : name;
  }
  if (watch.status === "exit") {
    const fallback = clockLabel(watch.exitedAt ?? watch.metAt);
    const name = contractLabel("exit", watch.lastDetectedTrend);
    return fallback ? `${name} · ${fallback}` : name;
  }
  return null;
}

function relationTone(relation: string): string {
  if (relation === "WITH_TREND") return "text-ocean-teal";
  if (relation === "COUNTERTREND") return "text-ocean-danger";
  return "text-amber-400";
}

function contractLabel(
  kind: "buy" | "exit",
  trend: MarketAlarmWatch["lastDetectedTrend"],
): string {
  const action = kind === "buy" ? "Buy" : "Exit";
  if (trend === "alcista") return `${action} Call`;
  if (trend === "bajista") return `${action} Put`;
  return action;
}

function SignalOverlay({
  kind,
  trend,
}: {
  kind: "buy" | "exit";
  trend?: MarketAlarmWatch["lastDetectedTrend"];
}) {
  const buy = kind === "buy";
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md",
        buy ? "bg-ocean-teal/35" : "bg-amber-500/35",
      )}
      aria-hidden
    >
      <span
        className={cn(
          "animate-ov-alarm-blink whitespace-nowrap rounded-md px-3 py-1.5 font-display text-xl font-bold tracking-[0.08em] uppercase shadow-sm sm:text-2xl",
          buy
            ? "bg-ocean-teal text-ocean-deep"
            : "bg-amber-400 text-ocean-deep",
        )}
      >
        {contractLabel(kind, trend)}
      </span>
    </div>
  );
}

function MovementWatchCard({
  watch,
  name,
  onCheckNow,
  onStart,
  onStop,
  onRemove,
  onConfirmEnter,
  onConfirmExit,
  onClearMetStatus,
  onEnlargeChart,
}: {
  watch: MarketAlarmWatch;
  name?: string;
  onCheckNow: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRemove: (id: string) => void;
  onConfirmEnter: (id: string) => void;
  onConfirmExit: (id: string) => void;
  onClearMetStatus: (id: string, opts?: { restart?: boolean }) => void;
  onEnlargeChart: (id: string) => void;
}) {
  const polling =
    watch.status === "running" ||
    watch.status === "checking" ||
    watch.status === "paused" ||
    watch.status === "in_trade";
  const awaitingUser = watch.status === "met" || watch.status === "exit";
  const fiveMinute = usesFiveMinuteChart(watch);
  const data = chartForWatch(watch);
  const side =
    watch.lastDetectedTrend === "alcista" || watch.lastDetectedTrend === "bajista"
      ? formatAlarmTrend(watch.lastDetectedTrend)
      : null;
  const lastAlarm = lastAlarmLine(watch);
  const entryTitle = lastEntryTitle(watch);
  const [entriesOpen, setEntriesOpen] = useState(false);
  const showChart =
    watchRuleKeys(watch).some(
      (key) =>
        key === "trend_change_5m" ||
        key === "trend_change_15m" ||
        key === "ema_cross_5m" ||
        key === "breakout_quality" ||
        key === "orb_breakout_5m",
    ) || Boolean(data?.bars?.length);

  return (
    <article
      className={cn(
        "relative flex flex-col overflow-hidden rounded-lg border p-2",
        cardTone(watch.status),
      )}
      aria-label={`${watch.symbol} ${watch.ruleLabel}`}
    >
      <header className="mb-1 flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold tabular-nums text-ocean-foam">
            {watch.symbol}
            {name ? (
              <span className="ml-1 text-[10px] font-normal text-ocean-sand">{name}</span>
            ) : null}
          </p>
          <p className="truncate text-[10px] text-ocean-sand">
            {watch.ruleLabel}
            {side ? ` · ${side}` : ""}
          </p>
          {lastAlarm ? (
            <p className="truncate text-[10px] font-semibold text-ocean-foam">
              Last alarm · {lastAlarm}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 rounded border border-ocean-mid/40 px-1 py-0.5 text-[9px] uppercase tracking-wide text-ocean-sand">
          {watch.status}
        </span>
      </header>

      {watch.lastHourRelation ? (
        <p
          className={cn(
            "mb-0.5 text-center font-display text-2xl font-bold tracking-[0.14em] sm:text-3xl",
            relationTone(watch.lastHourRelation),
          )}
        >
          {watch.lastHourRelation.replaceAll("_", " ")}
        </p>
      ) : null}
      {watch.lastHourRegime ? (
        <p className="mb-1 text-center text-[11px] uppercase tracking-wide text-ocean-sand">
          1h {watch.lastHourRegime.replaceAll("_", " ")}
        </p>
      ) : null}

      {entryTitle ? (
        <p className="mb-1 truncate text-[11px] font-semibold tabular-nums text-ocean-foam">
          {entryTitle}
        </p>
      ) : null}

      {showChart ? (
        <button
          type="button"
          onClick={() => onEnlargeChart(watch.id)}
          className="relative mb-1.5 aspect-[16/10] w-full overflow-hidden rounded-md border border-ocean-mid/30 bg-ocean-surface/40 text-left hover:border-ocean-teal/45"
          title={`Enlarge ${watch.symbol} chart`}
        >
          <BbSparkline15mChart
            data={
              data ??
              (fiveMinute
                ? { symbol: watch.symbol, timeframe: "5m", bbPeriod: 20, bars: [] }
                : null)
            }
            breakoutLevel={fiveMinute ? null : watch.lastBreakoutLevel}
            entryAt={detectedEntryAt(watch)}
            entrySide={detectedEntrySide(watch)}
            variant="thumb"
            className="h-full"
          />
          {watch.status === "met" ? (
            <SignalOverlay kind="buy" trend={watch.lastDetectedTrend} />
          ) : null}
          {watch.status === "exit" ? (
            <SignalOverlay kind="exit" trend={watch.lastDetectedTrend} />
          ) : null}
        </button>
      ) : null}
      {fiveMinute && showChart ? (
        <p className="mb-1.5 flex flex-wrap gap-x-2 text-[9px] text-ocean-sand">
          <span>5m</span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-2.5 rounded-sm bg-amber-300" />
            EMA 10
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-2.5 rounded-sm bg-rose-300" />
            EMA 21
          </span>
        </p>
      ) : null}
      {!showChart ? (
        <div className="relative mb-1.5 flex aspect-[16/10] w-full items-center justify-center rounded-md border border-dashed border-ocean-mid/30 bg-ocean-surface/20">
          <p className="px-2 text-center text-[10px] text-ocean-sand/70">
            Chart after next check
          </p>
          {watch.status === "met" ? (
            <SignalOverlay kind="buy" trend={watch.lastDetectedTrend} />
          ) : null}
          {watch.status === "exit" ? (
            <SignalOverlay kind="exit" trend={watch.lastDetectedTrend} />
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-1">
        {watch.status === "met" ? (
          <button
            type="button"
            className={cn(BTN, "bg-ocean-teal text-ocean-deep")}
            onClick={() => onConfirmEnter(watch.id)}
          >
            Entered
          </button>
        ) : null}
        {watch.status === "exit" ? (
          <button
            type="button"
            className={cn(BTN, "bg-amber-500 text-ocean-deep")}
            onClick={() => onConfirmExit(watch.id)}
          >
            Exited
          </button>
        ) : null}
        {awaitingUser || watch.status === "in_trade" ? (
          <button
            type="button"
            className={cn(BTN, "border border-ocean-mid/40 text-ocean-sand")}
            onClick={() => onClearMetStatus(watch.id)}
          >
            Clear
          </button>
        ) : null}
        {polling ? (
          <button
            type="button"
            className={cn(BTN, "border border-ocean-mid/40 text-ocean-foam")}
            disabled={watch.status === "checking"}
            onClick={() => onCheckNow(watch.id)}
          >
            {watch.status === "checking" ? "…" : "Check"}
          </button>
        ) : (
          <button
            type="button"
            className={cn(BTN, "border border-ocean-mid/40 text-ocean-foam")}
            onClick={() => onStart(watch.id)}
          >
            Start
          </button>
        )}
        {polling ? (
          <button
            type="button"
            className={cn(BTN, "border border-ocean-mid/40 text-ocean-sand")}
            onClick={() => onStop(watch.id)}
          >
            Stop
          </button>
        ) : null}
        <button
          type="button"
          className={cn(BTN, "border border-ocean-mid/40 text-ocean-foam")}
          onClick={() => setEntriesOpen(true)}
        >
          Entries
        </button>
        <button
          type="button"
          className={cn(BTN, "border border-ocean-danger/50 text-ocean-danger")}
          onClick={() => onRemove(watch.id)}
        >
          Remove
        </button>
      </div>
      {entriesOpen ? (
        <TickerEntriesModal symbol={watch.symbol} onClose={() => setEntriesOpen(false)} />
      ) : null}
    </article>
  );
}

function FitGraphThumb({
  watch,
  name,
  onEnlargeChart,
}: {
  watch: MarketAlarmWatch;
  name?: string;
  onEnlargeChart: (id: string) => void;
}) {
  const fiveMinute = usesFiveMinuteChart(watch);
  const data = chartForWatch(watch);
  const showChart =
    watchRuleKeys(watch).some(
      (key) =>
        key === "trend_change_5m" ||
        key === "trend_change_15m" ||
        key === "ema_cross_5m" ||
        key === "breakout_quality" ||
        key === "orb_breakout_5m",
    ) || Boolean(data?.bars?.length);

  return (
    <div
      className="flex h-full w-full min-h-0 min-w-0 items-center justify-center"
      style={{ containerType: "size" }}
      role="listitem"
    >
      <button
        type="button"
        onClick={() => onEnlargeChart(watch.id)}
        className={cn(
          "relative overflow-hidden rounded-md border bg-ocean-surface/40 text-left hover:border-ocean-teal/45",
          cardTone(watch.status),
        )}
        style={{
          aspectRatio: "16 / 10",
          width: "min(100cqw, calc(100cqh * 16 / 10))",
          height: "min(100cqh, calc(100cqw * 10 / 16))",
        }}
        title={`Enlarge ${watch.symbol} chart`}
        aria-label={`${watch.symbol} ${watch.ruleLabel}`}
      >
        {showChart ? (
          <BbSparkline15mChart
            data={
              data ??
              (fiveMinute
                ? { symbol: watch.symbol, timeframe: "5m", bbPeriod: 20, bars: [] }
                : null)
            }
            breakoutLevel={fiveMinute ? null : watch.lastBreakoutLevel}
            entryAt={detectedEntryAt(watch)}
            entrySide={detectedEntrySide(watch)}
            variant="thumb"
            className="absolute inset-0 h-full"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-[10px] text-ocean-sand/70">
            Chart after next check
          </span>
        )}
        <span className="pointer-events-none absolute top-1 left-1 z-20 max-w-[80%] truncate rounded bg-ocean-deep/80 px-1 py-0.5 font-display text-[10px] font-semibold text-ocean-foam">
          {watch.symbol}
          {name ? <span className="ml-1 font-normal text-ocean-sand">{name}</span> : null}
        </span>
        {watch.status === "met" ? (
          <SignalOverlay kind="buy" trend={watch.lastDetectedTrend} />
        ) : null}
        {watch.status === "exit" ? (
          <SignalOverlay kind="exit" trend={watch.lastDetectedTrend} />
        ) : null}
      </button>
    </div>
  );
}

export function MovementWatchGrid({
  watches,
  tickerNameBySymbol,
  onCheckNow,
  onStart,
  onStop,
  onRemove,
  onConfirmEnter,
  onConfirmExit,
  onClearMetStatus,
  onEnlargeChart,
  layoutClassName,
  fitViewport = false,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [pane, setPane] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!fitViewport) return;
    const node = frameRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      setPane((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [fitViewport, watches.length]);

  const sorted = useMemo(() => {
    return [...watches].sort((a, b) => {
      const rank = (s: MarketAlarmWatch["status"]) => {
        if (s === "met") return 0;
        if (s === "exit") return 1;
        if (s === "in_trade") return 2;
        if (s === "running" || s === "checking") return 3;
        return 4;
      };
      const delta = rank(a.status) - rank(b.status);
      if (delta !== 0) return delta;
      return a.symbol.localeCompare(b.symbol) || a.ruleLabel.localeCompare(b.ruleLabel);
    });
  }, [watches]);

  const fit = useMemo(
    () => fitThumbnailGrid(sorted.length, pane.width, pane.height),
    [pane.height, pane.width, sorted.length],
  );

  if (watches.length === 0) {
    return <p className="text-xs text-ocean-sand">No watches on this movement.</p>;
  }

  if (fitViewport) {
    return (
      <div ref={frameRef} className="h-full min-h-0" role="list" aria-label="Movement watches grid">
        <div
          className="grid h-full min-h-0"
          style={{
            gap: THUMB_GAP_PX,
            gridTemplateColumns: `repeat(${fit.columns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${fit.rows}, minmax(0, 1fr))`,
          }}
        >
          {sorted.map((watch) => (
            <FitGraphThumb
              key={watch.id}
              watch={watch}
              name={tickerNameBySymbol.get(watch.symbol.toUpperCase())}
              onEnlargeChart={onEnlargeChart}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        layoutClassName ??
        "grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      }
      role="list"
      aria-label="Movement watches grid"
    >
      {sorted.map((watch) => (
        <div key={watch.id} role="listitem">
          <MovementWatchCard
            watch={watch}
            name={tickerNameBySymbol.get(watch.symbol.toUpperCase())}
            onCheckNow={onCheckNow}
            onStart={onStart}
            onStop={onStop}
            onRemove={onRemove}
            onConfirmEnter={onConfirmEnter}
            onConfirmExit={onConfirmExit}
            onClearMetStatus={onClearMetStatus}
            onEnlargeChart={onEnlargeChart}
          />
        </div>
      ))}
    </div>
  );
}
