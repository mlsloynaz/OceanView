import { cn } from "@/shared/lib/cn";
import { BbSparkline15mChart } from "./BbSparkline15mChart";
import {
  formatAlarmTrend,
  watchRuleKeys,
  type MarketAlarmWatch,
} from "./alarm-types";

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
};

function chartData(watch: MarketAlarmWatch) {
  if (watch.lastMovementChart?.bars?.length) return watch.lastMovementChart;
  if (watch.lastBbSparkline15m?.bars?.length) return watch.lastBbSparkline15m;
  return watch.lastMovementChart ?? watch.lastBbSparkline15m ?? null;
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

function entryPathLabel(path: string | null | undefined): string | null {
  if (path === "early_continuation") return "Early continuation";
  if (path === "early_reversal") return "Early reversal";
  if (path === "confirmed_5m") return "Confirmed 5m";
  return null;
}

function triggerLabel(trigger: string | null | undefined): string | null {
  if (trigger === "pullback_recovery") return "EMA reclaim";
  if (trigger === "ema_crossover") return "EMA cross";
  if (trigger === "momentum_turn") return "Momentum turn";
  if (trigger === "ema_hold") return "EMA hold";
  return null;
}

function confirmationLabel(path: string | null | undefined): string | null {
  if (path === "early_continuation" || path === "early_reversal") return "Provisional";
  if (path === "confirmed_5m") return "Completed";
  return null;
}

function roomLine(watch: MarketAlarmWatch): string | null {
  const room = watch.lastRoomByPath;
  const shadow = watch.lastShadowEarly;
  const confirmed =
    room?.confirmed_5m?.optionGainPct ?? shadow?.confirmedOptionGainPct ?? null;
  const early = room?.early?.optionGainPct ?? shadow?.earlyOptionGainPct ?? null;
  const parts: string[] = [];
  if (typeof confirmed === "number") parts.push(`confirmed ${confirmed}%`);
  if (typeof early === "number") parts.push(`early ${early}%`);
  if (parts.length === 0) return null;
  return `Option room · ${parts.join(" · ")}`;
}

function FactRows({
  path,
  state,
  trigger,
  entryEvent,
  muted,
}: {
  path?: string | null;
  state?: string | null;
  trigger?: string | null;
  entryEvent?: boolean | null;
  muted?: boolean;
}) {
  const rows = [
    ["Entry path", entryPathLabel(path)],
    ["Movement state", state || null],
    ["1m trigger", triggerLabel(trigger)],
    ["5m confirmation", confirmationLabel(path)],
    ["Entry event", entryEvent ? "New" : null],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  if (rows.length === 0) return null;
  return (
    <dl className={cn("grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5", muted && "opacity-80")}>
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-ocean-sand">{label}</dt>
          <dd className="text-right font-medium text-ocean-foam">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function FiveMinuteEntryFacts({ watch }: { watch: MarketAlarmWatch }) {
  if (!watchRuleKeys(watch).includes("trend_change_5m")) return null;
  const shadow = watch.lastShadowEarly;
  const shadowPath = shadow?.entryPath;
  const hasLive = Boolean(
    entryPathLabel(watch.lastEntryPath) ||
      watch.lastMovementState ||
      triggerLabel(watch.lastTriggerType),
  );
  const showShadow =
    typeof shadowPath === "string" &&
    shadowPath.length > 0 &&
    shadowPath !== watch.lastEntryPath;
  const room = roomLine(watch);
  if (!hasLive && !showShadow && !room) return null;
  return (
    <div className="mb-1 space-y-1 text-[10px] leading-tight">
      {hasLive ? (
        <FactRows
          path={watch.lastEntryPath}
          state={watch.lastMovementState}
          trigger={watch.lastTriggerType}
          entryEvent={watch.lastEntryEvent}
        />
      ) : null}
      {showShadow ? (
        <div>
          <p className="text-[9px] uppercase tracking-wide text-ocean-sand">Shadow</p>
          <FactRows
            path={shadowPath}
            state={shadow?.movementState}
            trigger={shadow?.triggerType}
            muted
          />
        </div>
      ) : null}
      {room ? <p className="text-ocean-sand">{room}</p> : null}
    </div>
  );
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
  const data = chartData(watch);
  const side =
    watch.lastDetectedTrend === "alcista" || watch.lastDetectedTrend === "bajista"
      ? formatAlarmTrend(watch.lastDetectedTrend)
      : null;
  const lastAlarm = lastAlarmLine(watch);
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

      <FiveMinuteEntryFacts watch={watch} />

      {showChart ? (
        <button
          type="button"
          onClick={() => onEnlargeChart(watch.id)}
          className="relative mb-1.5 aspect-[16/10] w-full overflow-hidden rounded-md border border-ocean-mid/30 bg-ocean-surface/40 text-left hover:border-ocean-teal/45"
          title={`Enlarge ${watch.symbol} chart`}
        >
          <BbSparkline15mChart
            data={data}
            breakoutLevel={watch.lastBreakoutLevel}
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
      ) : (
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
      )}

      <p className="mb-1.5 line-clamp-2 text-[10px] leading-snug text-ocean-sand">
        {watch.lastError
          ? watch.lastError
          : watch.status === "exit" && watch.exitEvidence
            ? watch.exitEvidence
            : watch.lastEvidence || "Waiting for signal…"}
      </p>

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
          className={cn(BTN, "border border-ocean-danger/50 text-ocean-danger")}
          onClick={() => onRemove(watch.id)}
        >
          Remove
        </button>
      </div>
    </article>
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
}: Props) {
  if (watches.length === 0) {
    return <p className="text-xs text-ocean-sand">No watches on this movement.</p>;
  }

  const sorted = [...watches].sort((a, b) => {
    const rank = (s: MarketAlarmWatch["status"]) => {
      if (s === "met") return 0;
      if (s === "exit") return 1;
      if (s === "in_trade") return 2;
      if (s === "running" || s === "checking") return 3;
      return 4;
    };
    const d = rank(a.status) - rank(b.status);
    if (d !== 0) return d;
    return a.symbol.localeCompare(b.symbol) || a.ruleLabel.localeCompare(b.ruleLabel);
  });

  return (
    <div
      className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
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
