/** Breakout Alarm Kanban — Setup → (15m BB chart) → Confirmed → Entry (alert only on Entry). */

import { cn } from "@/shared/lib/cn";
import { formatAlarmTrend, type MarketAlarmWatch } from "./alarm-types";

export const BREAKOUT_KANBAN_COLUMNS = [
  {
    id: "setup",
    title: "Setup",
    hint: "Forming / testing — VWAP reclaim, squeeze, approach, probing BB or structure",
  },
  {
    id: "confirmed",
    title: "Confirmed",
    hint: "Break happened — waiting entry quality",
  },
  {
    id: "entry",
    title: "Entry",
    hint: "Actionable — only this stage alerts",
  },
] as const;

export type BreakoutKanbanColumnId = (typeof BREAKOUT_KANBAN_COLUMNS)[number]["id"];

/** Visual board order: lifecycle columns + chart panel slot (Phase 2+ fills the chart). */
const BOARD_SLOT_ORDER = ["setup", "chart", "confirmed", "entry"] as const;
type BoardSlotId = (typeof BOARD_SLOT_ORDER)[number];

const BTN =
  "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export function watchHasBreakout(watch: MarketAlarmWatch): boolean {
  const keys = watch.ruleKeys?.length ? watch.ruleKeys : [watch.ruleKey];
  return keys.includes("breakout_quality");
}

/** Map API lifecycle (+ watch status) → one Kanban column. */
export function breakoutKanbanColumn(watch: MarketAlarmWatch): BreakoutKanbanColumnId {
  if (watch.status === "met" || watch.status === "in_trade" || watch.status === "exit") {
    return "entry";
  }
  const life = String(watch.lastLifecycle || "").toLowerCase();
  if (life === "entry_ready") return "entry";
  if (
    life === "confirmed" ||
    life === "breakout_confirmed" ||
    life === "awaiting_entry" ||
    life === "extended"
  ) {
    return "confirmed";
  }
  if (life === "failed") return "confirmed";
  // setup_forming, testing_level, idle, unknown, unscanned
  return "setup";
}

function lifecycleChip(watch: MarketAlarmWatch): string {
  if (watch.status === "met") return "ENTER";
  if (watch.status === "in_trade") return "in trade";
  if (watch.status === "exit") return "EXIT";
  const life = String(watch.lastLifecycle || "").trim();
  if (!life) return watch.status === "checking" ? "checking…" : "queued";
  return life.replace(/_/g, " ");
}

function WatchCard({
  watch: w,
  name,
  onCheckNow,
  onStart,
  onStop,
  onRemove,
  onClearMetStatus,
}: {
  watch: MarketAlarmWatch;
  name: string | undefined;
  onCheckNow: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRemove: (id: string) => void;
  onClearMetStatus: (id: string, opts?: { restart?: boolean }) => void;
}) {
  const polling =
    w.status === "running" ||
    w.status === "checking" ||
    w.status === "paused" ||
    w.status === "in_trade";
  const awaitingUser = w.status === "met" || w.status === "exit";
  const side =
    w.lastDetectedTrend === "alcista" || w.lastDetectedTrend === "bajista"
      ? formatAlarmTrend(w.lastDetectedTrend)
      : w.trend === "auto"
        ? "Auto"
        : formatAlarmTrend(w.trend);
  const otherRules = (w.lastRuleResults ?? []).filter((r) => r.ruleKey !== "breakout_quality");

  return (
    <li
      className={cn(
        "rounded-md border px-2 py-1.5",
        w.status === "met"
          ? "border-ocean-teal/50 bg-ocean-teal/10"
          : w.status === "exit"
            ? "border-amber-500/50 bg-amber-500/10"
            : w.lastLifecycle === "failed" || w.lastLifecycle === "extended"
              ? "border-ocean-danger/40 bg-ocean-danger/5"
              : "border-ocean-mid/30 bg-ocean-surface/50",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="text-xs font-semibold tabular-nums text-ocean-foam">
            {w.symbol}
            <span className="ml-1 font-normal text-ocean-sand">· {side}</span>
          </p>
          {name ? <p className="truncate text-[10px] text-ocean-sand/80">{name}</p> : null}
        </div>
        <span className="shrink-0 rounded bg-ocean-deep/40 px-1 py-0.5 text-[10px] capitalize text-ocean-sand">
          {lifecycleChip(w)}
        </span>
      </div>

      <p className="mt-1 text-[10px] tabular-nums text-ocean-sand">
        {typeof w.lastBreakoutScore === "number"
          ? `score ${Math.round(w.lastBreakoutScore)}`
          : "score —"}
        {typeof w.lastContinuationScore === "number"
          ? ` · cont ${Math.round(w.lastContinuationScore)}`
          : ""}
        {w.lastBreakoutType && w.lastBreakoutType !== "none"
          ? ` · ${w.lastBreakoutType.replace(/_/g, " ")}`
          : ""}
      </p>

      {w.lastSetupType && w.lastSetupType !== "none" ? (
        <p className="text-[10px] text-ocean-sand/90">
          setup {w.lastSetupType.replace(/_/g, " ")}
        </p>
      ) : null}

      {otherRules.length > 0 ? (
        <ul className="mt-1 space-y-0.5">
          {otherRules.map((r) => (
            <li
              key={r.ruleKey}
              className="truncate text-[10px] text-ocean-sand"
              title={r.evidence ?? undefined}
            >
              <span
                className={cn(
                  "font-medium",
                  r.met || r.status === "met"
                    ? "text-ocean-teal-dim dark:text-ocean-teal"
                    : "text-ocean-sand",
                )}
              >
                {r.status}
              </span>{" "}
              {r.ruleKey.replace(/_/g, " ")}
            </li>
          ))}
        </ul>
      ) : null}

      {w.lastError ? <p className="mt-1 text-[10px] text-ocean-danger">{w.lastError}</p> : null}

      <div className="mt-1.5 flex flex-wrap gap-1">
        <button
          type="button"
          className={cn(BTN, "border border-ocean-mid/40 text-ocean-sand")}
          disabled={w.status === "checking"}
          onClick={() => onCheckNow(w.id)}
        >
          Check
        </button>
        {!awaitingUser ? (
          polling ? (
            <button
              type="button"
              className={cn(
                BTN,
                "border border-ocean-danger/50 text-ocean-danger hover:bg-ocean-danger/10",
              )}
              onClick={() => onStop(w.id)}
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              className={cn(
                BTN,
                "border border-ocean-teal/40 text-ocean-teal-dim dark:text-ocean-teal",
              )}
              onClick={() => onStart(w.id)}
            >
              Start
            </button>
          )
        ) : (
          <button
            type="button"
            className={cn(BTN, "border border-ocean-mid/40 text-ocean-sand")}
            onClick={() => onClearMetStatus(w.id)}
          >
            Clear
          </button>
        )}
        <button
          type="button"
          className={cn(BTN, "border border-ocean-danger/50 text-ocean-danger hover:bg-ocean-danger/10")}
          onClick={() => onRemove(w.id)}
        >
          Remove
        </button>
      </div>
    </li>
  );
}

function ChartPanelPlaceholder() {
  return (
    <section
      className="flex min-h-[12rem] flex-col rounded-lg border border-dashed border-ocean-mid/40 bg-ocean-deep/15 px-2.5 py-2"
      aria-labelledby="breakout-kanban-chart"
    >
      <header className="mb-2 border-b border-ocean-mid/25 pb-1.5">
        <h3 id="breakout-kanban-chart" className="text-xs font-semibold text-ocean-foam">
          15m BB
        </h3>
        <p className="mt-0.5 text-[10px] leading-snug text-ocean-sand/80">
          Mini Bollinger chart — coming next (current + last 8 candles)
        </p>
      </header>
      <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-ocean-mid/25 px-2 py-4 text-center text-[11px] text-ocean-sand/70">
        Chart panel placeholder
      </div>
    </section>
  );
}

type Props = {
  watches: MarketAlarmWatch[];
  tickerNameBySymbol: Map<string, string>;
  onCheckNow: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRemove: (id: string) => void;
  onClearMetStatus: (id: string, opts?: { restart?: boolean }) => void;
};

export function BreakoutKanbanBoard({
  watches,
  tickerNameBySymbol,
  onCheckNow,
  onStart,
  onStop,
  onRemove,
  onClearMetStatus,
}: Props) {
  const breakoutWatches = watches.filter(watchHasBreakout);
  if (breakoutWatches.length === 0) return null;

  const byColumn = BREAKOUT_KANBAN_COLUMNS.reduce(
    (acc, col) => {
      acc[col.id] = [];
      return acc;
    },
    {} as Record<BreakoutKanbanColumnId, MarketAlarmWatch[]>,
  );

  for (const w of breakoutWatches) {
    byColumn[breakoutKanbanColumn(w)].push(w);
  }

  for (const col of BREAKOUT_KANBAN_COLUMNS) {
    byColumn[col.id].sort((a, b) => {
      const sa = a.lastBreakoutScore ?? -1;
      const sb = b.lastBreakoutScore ?? -1;
      if (sb !== sa) return sb - sa;
      return a.symbol.localeCompare(b.symbol);
    });
  }

  const colById = Object.fromEntries(BREAKOUT_KANBAN_COLUMNS.map((c) => [c.id, c])) as Record<
    BreakoutKanbanColumnId,
    (typeof BREAKOUT_KANBAN_COLUMNS)[number]
  >;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-ocean-foam">Breakout board</p>
          <p className="text-[11px] text-ocean-sand">
            One card per watch · stage from last check · bell rings when a card reaches{" "}
            <span className="font-medium text-ocean-foam">Entry</span> (until you confirm or
            dismiss)
          </p>
        </div>
        <p className="text-[11px] tabular-nums text-ocean-sand">
          {breakoutWatches.length} breakout watch
          {breakoutWatches.length === 1 ? "" : "es"}
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {BOARD_SLOT_ORDER.map((slot: BoardSlotId) => {
          if (slot === "chart") {
            return <ChartPanelPlaceholder key="chart" />;
          }

          const col = colById[slot];
          const rows = byColumn[col.id];
          const isEntry = col.id === "entry";
          return (
            <section
              key={col.id}
              className={cn(
                "flex min-h-[12rem] flex-col rounded-lg border px-2.5 py-2",
                isEntry
                  ? "border-ocean-teal/45 bg-ocean-teal/5"
                  : "border-ocean-mid/35 bg-ocean-deep/20",
              )}
              aria-labelledby={`breakout-kanban-${col.id}`}
            >
              <header className="mb-2 border-b border-ocean-mid/25 pb-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3
                    id={`breakout-kanban-${col.id}`}
                    className={cn(
                      "text-xs font-semibold",
                      isEntry ? "text-ocean-teal-dim dark:text-ocean-teal" : "text-ocean-foam",
                    )}
                  >
                    {col.title}
                    {isEntry ? " 🔔" : ""}
                  </h3>
                  <span className="text-[11px] tabular-nums text-ocean-sand">{rows.length}</span>
                </div>
                <p className="mt-0.5 text-[10px] leading-snug text-ocean-sand/80">{col.hint}</p>
              </header>

              <ul className="flex flex-1 flex-col gap-1.5">
                {rows.length === 0 ? (
                  <li className="rounded-md border border-dashed border-ocean-mid/30 px-2 py-3 text-center text-[11px] text-ocean-sand/70">
                    No tickers
                  </li>
                ) : (
                  rows.map((w) => (
                    <WatchCard
                      key={w.id}
                      watch={w}
                      name={tickerNameBySymbol.get(w.symbol)}
                      onCheckNow={onCheckNow}
                      onStart={onStart}
                      onStop={onStop}
                      onRemove={onRemove}
                      onClearMetStatus={onClearMetStatus}
                    />
                  ))
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
