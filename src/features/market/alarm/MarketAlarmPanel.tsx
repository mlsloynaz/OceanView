import { useMemo, useState } from "react";
import {
  PollControls,
  clampPollInterval,
  type PollIntervalUnit,
} from "@/shared/components/PollControls";
import {
  LiveSimulateControl,
  type LiveSimulateMode,
} from "@/shared/components/LiveSimulateControl";
import { cn } from "@/shared/lib/cn";
import type { CatalogTicker } from "@/features/admin/tickers/types";
import { AlarmTradeModal } from "./AlarmTradeModal";
import { BreakoutKanbanBoard, watchHasBreakout } from "./BreakoutKanbanBoard";
import {
  ALARM_ELIGIBLE_RULES,
  formatAlarmTrend,
  needsBandTimeframe,
  needsTrendPicker,
  type AlarmBandTimeframe,
  type AlarmEligibleRuleKey,
  type AlarmPopupKind,
  type AlarmTrend,
  type MarketAlarmWatch,
} from "./alarm-types";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

function groupWatchesBySymbol(
  watches: MarketAlarmWatch[],
): { symbol: string; watches: MarketAlarmWatch[] }[] {
  const map = new Map<string, MarketAlarmWatch[]>();
  for (const w of watches) {
    const list = map.get(w.symbol) ?? [];
    list.push(w);
    map.set(w.symbol, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([symbol, rows]) => ({ symbol, watches: rows }));
}

function groupStatusTone(rows: MarketAlarmWatch[]): "met" | "exit" | "in_trade" | "active" | "idle" {
  if (rows.some((w) => w.status === "met")) return "met";
  if (rows.some((w) => w.status === "exit")) return "exit";
  if (rows.some((w) => w.status === "in_trade")) return "in_trade";
  if (rows.some((w) => w.status === "running" || w.status === "checking")) return "active";
  return "idle";
}

type Props = {
  watches: MarketAlarmWatch[];
  tickers: CatalogTicker[];
  tickersLoading: boolean;
  tickersError: string | null;
  formError: string | null;
  banner: string | null;
  alarmPopup: { kind: AlarmPopupKind; watch: MarketAlarmWatch } | null;
  metCount: number;
  runningCount: number;
  timeMode: LiveSimulateMode;
  simulateLocal: string;
  onTimeModeChange: (mode: LiveSimulateMode) => void;
  onSimulateLocalChange: (value: string) => void;
  onClearBanner: () => void;
  onClearAlarmPopup: () => void;
  onConfirmEnter: (id: string) => void;
  onConfirmExit: (id: string) => void;
  onAdd: (input: {
    symbols: string[];
    ruleKeys: AlarmEligibleRuleKey[];
    trend: AlarmTrend;
    bandTimeframe?: AlarmBandTimeframe;
    frequencyValue: number;
    frequencyUnit: PollIntervalUnit;
    startAfterAdd?: boolean;
  }) => boolean;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onStartAllIdle: () => void;
  onStopAllRunning: () => void;
  onClearMetStatus: (id: string, opts?: { restart?: boolean }) => void;
  onClearAllMetStatuses: () => void;
  onRemove: (id: string) => void;
  onCheckNow: (id: string) => void;
  onUpdateInterval: (id: string, value: number, unit: PollIntervalUnit) => void;
  onRequestNotify: () => void;
};

function statusLabel(status: MarketAlarmWatch["status"]): string {
  switch (status) {
    case "running":
      return "Polling for enter";
    case "checking":
      return "Checking…";
    case "met":
      return "ENTER — confirm";
    case "in_trade":
      return "In trade — watching exit";
    case "exit":
      return "EXIT — confirm";
    case "stopped":
      return "Stopped";
    case "error":
      return "Error";
    default:
      return "Idle";
  }
}

export function MarketAlarmPanel({
  watches,
  tickers,
  tickersLoading,
  tickersError,
  formError,
  banner,
  alarmPopup,
  metCount,
  runningCount,
  timeMode,
  simulateLocal,
  onTimeModeChange,
  onSimulateLocalChange,
  onClearBanner,
  onClearAlarmPopup,
  onConfirmEnter,
  onConfirmExit,
  onAdd,
  onStart,
  onStop,
  onStartAllIdle,
  onStopAllRunning,
  onClearMetStatus,
  onClearAllMetStatuses,
  onRemove,
  onCheckNow,
  onUpdateInterval,
  onRequestNotify,
}: Props) {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [selectedRules, setSelectedRules] = useState<AlarmEligibleRuleKey[]>([
    "confirmation_change_trend_1h",
  ]);
  const [trend, setTrend] = useState<AlarmTrend>("alcista");
  const [bandTimeframe, setBandTimeframe] = useState<AlarmBandTimeframe>("1m");
  const [frequencyValue, setFrequencyValue] = useState(5);
  const [frequencyUnit, setFrequencyUnit] = useState<PollIntervalUnit>("min");
  const showBandTf = needsBandTimeframe(selectedRules);
  const showTrend = needsTrendPicker(selectedRules);

  const toggleRule = (key: AlarmEligibleRuleKey) => {
    setSelectedRules((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      if (next.length === 1 && next[0] === "breakout_quality") {
        setFrequencyUnit("sec");
        setFrequencyValue(30);
      }
      return next;
    });
  };

  const setIntervalValue = (raw: number) => {
    setFrequencyValue(clampPollInterval(raw, frequencyUnit));
  };
  const setIntervalUnit = (unit: PollIntervalUnit) => {
    setFrequencyUnit(unit);
    setFrequencyValue((v) => clampPollInterval(v, unit));
  };

  const allSelected =
    tickers.length > 0 && selectedSymbols.length > 0 && selectedSymbols.length === tickers.length;

  const nonBreakoutWatchesByTicker = useMemo(
    () => groupWatchesBySymbol(watches.filter((w) => !watchHasBreakout(w))),
    [watches],
  );
  const hasBreakoutWatches = useMemo(() => watches.some(watchHasBreakout), [watches]);
  const tickerNameBySymbol = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tickers) {
      if (t.name) map.set(t.symbol.toUpperCase(), t.name);
    }
    return map;
  }, [tickers]);

  const toggleSymbol = (symbol: string) => {
    const upper = symbol.toUpperCase();
    setSelectedSymbols((prev) =>
      prev.includes(upper) ? prev.filter((s) => s !== upper) : [...prev, upper],
    );
  };

  const selectAllTickers = () => {
    setSelectedSymbols(tickers.map((t) => t.symbol.toUpperCase()));
  };

  const clearTickerSelection = () => setSelectedSymbols([]);

  const subtitle =
    metCount > 0
      ? `${metCount} in enter/exit cycle · ${runningCount} active`
      : runningCount > 0
        ? `${runningCount} watch${runningCount === 1 ? "" : "es"} polling`
        : "Pick tickers + one or more rules (AND) · Start → ENTER → exit watch → EXIT → arm again";

  return (
    <>
      <section
        id="market-alarms"
        aria-labelledby="market-alarms-title"
        className="min-w-0 rounded-lg border border-ocean-teal/35 bg-ocean-deep/20 px-4 py-4"
      >
        <header className="mb-3">
          <h2 id="market-alarms-title" className="text-base font-semibold text-ocean-foam">
            Rule Alarm
          </h2>
          <p className="mt-0.5 text-xs text-ocean-sand">{subtitle}</p>
        </header>
        <div className="space-y-3 text-sm">
          <p className="text-xs leading-relaxed text-ocean-sand">
            Poll until <span className="font-medium text-ocean-foam">all</span> selected rules
            are <span className="font-medium text-ocean-foam">met</span> (AND) →{" "}
            <span className="font-medium text-ocean-foam">ENTER</span> popup. Breakout quality
            alerts only on <span className="font-medium text-ocean-foam">Entry</span> (not Setup /
            Testing / Confirmed). Confirm entry and keep watching until the setup drops →{" "}
            <span className="font-medium text-ocean-foam">EXIT</span>, then arm again.
          </p>
          {banner ? (
            <div
              className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-ocean-teal/40 bg-ocean-teal/15 px-3 py-2"
              role="alert"
            >
              <p className="font-semibold text-ocean-foam">{banner}</p>
              <button
                type="button"
                className={cn(BTN, "border border-ocean-mid/40 text-ocean-sand")}
                onClick={onClearBanner}
              >
                Dismiss
              </button>
            </div>
          ) : null}

          <p className="text-xs leading-relaxed text-ocean-sand">
            Eligible: confirmation candle 1h / 15m, Disipador touch (candle + BB on the
            Timeframe you pick: 1m / 15m / 1h), breakout quality. Select multiple criteria to
            require all at once. Alarm fires on the{" "}
            <strong className="font-medium text-ocean-foam">first</strong> combined met only.
            Select tickers (or{" "}
            <strong className="font-medium text-ocean-foam">Select all</strong>), rules, trend, and
            check interval. Add creates one watch per ticker; Start polls until met.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(BTN, "border border-ocean-mid/50 text-ocean-foam hover:bg-ocean-mid/20")}
              onClick={onRequestNotify}
              title="Allow browser notifications for fired alarms"
            >
              Enable desktop notify
            </button>
          </div>

          <div className="rounded-md border border-ocean-mid/30 bg-ocean-surface/30 px-3 py-2">
            <p className="mb-1.5 text-[11px] font-medium text-ocean-foam">
              Time mode (testing)
            </p>
            <LiveSimulateControl
              mode={timeMode}
              onModeChange={onTimeModeChange}
              simulateInput="datetime"
              simulateValue={simulateLocal}
              onSimulateChange={onSimulateLocalChange}
              simulateInputId="market-alarm-simulate-time"
              simulateLabel="As-of (ET)"
              showLiveClock
              liveHint="Live uses current market time + candle refresh."
              ariaLabel="Alarm live or simulate time"
            />
            {timeMode === "simulate" ? (
              <p className="mt-1.5 text-[11px] text-ocean-sand">
                Simulate evaluates watches as-of the ET datetime using stored candles (no
                Schwab refresh). Use Check now / Start to re-run at that moment.
              </p>
            ) : null}
          </div>

          <form
            className="grid gap-2 rounded-md border border-ocean-mid/30 bg-ocean-deep/20 p-3 sm:grid-cols-2 lg:grid-cols-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (selectedRules.length === 0) return;
              const ok = onAdd({
                symbols: selectedSymbols,
                ruleKeys: selectedRules,
                trend: showTrend ? trend : "auto",
                ...(showBandTf ? { bandTimeframe } : {}),
                frequencyValue,
                frequencyUnit,
              });
              if (ok) setSelectedSymbols([]);
            }}
          >
            <div className="flex flex-col gap-1.5 text-xs text-ocean-sand sm:col-span-2 lg:col-span-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Tickers
                  {selectedSymbols.length > 0 ? (
                    <span className="ml-1 text-ocean-foam">({selectedSymbols.length} selected)</span>
                  ) : null}
                </span>
                <span className="inline-flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className={cn(BTN, "border border-ocean-teal/40 text-ocean-teal-dim dark:text-ocean-teal")}
                    disabled={tickersLoading || tickers.length === 0 || allSelected}
                    onClick={selectAllTickers}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className={cn(BTN, "border border-ocean-mid/40 text-ocean-sand")}
                    disabled={selectedSymbols.length === 0}
                    onClick={clearTickerSelection}
                  >
                    Clear
                  </button>
                </span>
              </div>
              <div
                className="max-h-40 overflow-y-auto rounded-md border border-ocean-mid/40 bg-ocean-surface px-2 py-1.5"
                role="group"
                aria-label="Tickers to watch"
              >
                {tickersLoading ? (
                  <p className="py-1 text-ocean-sand">Loading tickers…</p>
                ) : tickers.length === 0 ? (
                  <p className="py-1 text-ocean-sand">No active tickers in catalog.</p>
                ) : (
                  <ul className="columns-2 gap-x-4 sm:columns-3 md:columns-4">
                    {tickers.map((t) => {
                      const upper = t.symbol.toUpperCase();
                      const checked = selectedSymbols.includes(upper);
                      return (
                        <li key={t.symbol} className="break-inside-avoid py-0.5">
                          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-ocean-foam hover:text-ocean-teal">
                            <input
                              type="checkbox"
                              className="rounded border-ocean-mid accent-ocean-teal"
                              checked={checked}
                              onChange={() => toggleSymbol(t.symbol)}
                            />
                            <span className="font-semibold tabular-nums">{t.symbol}</span>
                            {t.name ? (
                              <span className="truncate text-[11px] font-normal text-ocean-sand">
                                {t.name}
                              </span>
                            ) : null}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-xs text-ocean-sand sm:col-span-2 lg:col-span-6">
              <span>
                Rules (AND)
                {selectedRules.length > 0 ? (
                  <span className="ml-1 text-ocean-foam">({selectedRules.length} selected)</span>
                ) : null}
              </span>
              <div
                className="rounded-md border border-ocean-mid/40 bg-ocean-surface px-2 py-1.5"
                role="group"
                aria-label="Rules to combine"
              >
                <ul className="space-y-1">
                  {ALARM_ELIGIBLE_RULES.map((r) => {
                    const checked = selectedRules.includes(r.ruleKey);
                    return (
                      <li key={r.ruleKey}>
                        <label className="flex cursor-pointer items-start gap-1.5 text-sm text-ocean-foam hover:text-ocean-teal">
                          <input
                            type="checkbox"
                            className="mt-0.5 rounded border-ocean-mid accent-ocean-teal"
                            checked={checked}
                            onChange={() => toggleRule(r.ruleKey)}
                          />
                          <span>
                            <span className="font-medium">{r.label}</span>
                            <span className="mt-0.5 block font-mono text-[10px] text-ocean-sand/80">
                              {r.ruleKey}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            {showTrend ? (
              <label className="flex flex-col gap-1 text-xs text-ocean-sand">
                Trend
                <select
                  className="rounded-md border border-ocean-mid/40 bg-ocean-surface px-2 py-1.5 text-sm text-ocean-foam"
                  value={trend}
                  onChange={(e) => setTrend(e.target.value as AlarmTrend)}
                  required
                >
                  <option value="alcista">Alcista</option>
                  <option value="bajista">Bajista</option>
                </select>
              </label>
            ) : null}

            {showBandTf ? (
              <label className="flex flex-col gap-1 text-xs text-ocean-sand">
                Timeframe
                <select
                  className="rounded-md border border-ocean-mid/40 bg-ocean-surface px-2 py-1.5 text-sm text-ocean-foam"
                  value={bandTimeframe}
                  onChange={(e) => setBandTimeframe(e.target.value as AlarmBandTimeframe)}
                  title="Candle and Bollinger both use this timeframe"
                >
                  <option value="1m">1m</option>
                  <option value="15m">15m</option>
                  <option value="1h">1h</option>
                </select>
                <span className="text-[11px] leading-snug text-ocean-sand/90">
                  Candle and Bollinger both use this timeframe (Disipador)
                </span>
              </label>
            ) : null}

            <label className="flex flex-col gap-1 text-xs text-ocean-sand lg:col-span-2">
              Check every
              <span className="flex flex-wrap items-center gap-1.5">
                <input
                  type="number"
                  min={frequencyUnit === "sec" ? 5 : 1}
                  max={frequencyUnit === "hour" ? 24 : frequencyUnit === "sec" ? 3600 : 60}
                  step={1}
                  value={frequencyValue}
                  onChange={(e) => {
                    const next = Number.parseInt(e.target.value, 10);
                    if (!Number.isNaN(next)) setIntervalValue(next);
                  }}
                  className="w-16 rounded-md border border-ocean-mid/40 bg-ocean-surface px-2 py-1.5 text-sm tabular-nums text-ocean-foam"
                  aria-label="Check interval value"
                />
                <select
                  value={frequencyUnit}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "sec" || v === "min" || v === "hour") setIntervalUnit(v);
                  }}
                  className="rounded-md border border-ocean-mid/40 bg-ocean-surface px-2 py-1.5 text-sm text-ocean-foam"
                  aria-label="Check interval unit"
                >
                  <option value="sec">sec</option>
                  <option value="min">min</option>
                  <option value="hour">hour</option>
                </select>
              </span>
            </label>

            <div className="flex flex-wrap items-end gap-2 lg:col-span-6">
              <button
                type="submit"
                className={cn(BTN, "border border-ocean-mid/50 text-ocean-foam hover:bg-ocean-mid/20")}
                disabled={
                  tickers.length === 0 ||
                  selectedSymbols.length === 0 ||
                  selectedRules.length === 0
                }
              >
                {selectedSymbols.length > 1
                  ? `Add ${selectedSymbols.length} watches`
                  : "Add watch"}
              </button>
              <button
                type="button"
                className={cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-110")}
                disabled={
                  tickers.length === 0 ||
                  selectedSymbols.length === 0 ||
                  selectedRules.length === 0
                }
                onClick={() => {
                  const ok = onAdd({
                    symbols: selectedSymbols,
                    ruleKeys: selectedRules,
                    trend: showTrend ? trend : "auto",
                    ...(showBandTf ? { bandTimeframe } : {}),
                    frequencyValue,
                    frequencyUnit,
                    startAfterAdd: true,
                  });
                  if (ok) setSelectedSymbols([]);
                }}
              >
                {selectedSymbols.length > 1
                  ? `Add & start ${selectedSymbols.length}`
                  : "Add & start"}
              </button>
            </div>
          </form>

          {(formError || tickersError) && (
            <p className="text-xs text-ocean-sand" role="status">
              {formError || tickersError}
            </p>
          )}

          {watches.length === 0 ? (
            <p className="text-xs text-ocean-sand">
              No watches yet — select tickers + one or more rules + trend above.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-110")}
                  onClick={onStartAllIdle}
                  disabled={
                    !watches.some(
                      (w) =>
                        w.status === "idle" || w.status === "stopped" || w.status === "error",
                    )
                  }
                >
                  Start all idle
                </button>
                <button
                  type="button"
                  className={cn(
                    BTN,
                    "border border-amber-600/50 bg-amber-500/10 text-amber-900 dark:text-amber-100",
                  )}
                  onClick={onStopAllRunning}
                  disabled={runningCount === 0}
                >
                  Stop all polling
                </button>
                <button
                  type="button"
                  className={cn(
                    BTN,
                    "border border-ocean-teal/50 bg-ocean-teal/10 text-ocean-foam hover:bg-ocean-teal/20",
                  )}
                  onClick={onClearAllMetStatuses}
                  disabled={metCount === 0}
                  title="Reset fired alarms so they can poll and fire again"
                >
                  Clear all signals{metCount > 0 ? ` (${metCount})` : ""}
                </button>
              </div>
            {hasBreakoutWatches ? (
              <BreakoutKanbanBoard
                watches={watches}
                tickerNameBySymbol={tickerNameBySymbol}
                onCheckNow={onCheckNow}
                onStart={onStart}
                onStop={onStop}
                onRemove={onRemove}
                onClearMetStatus={onClearMetStatus}
              />
            ) : null}
            <div className="space-y-4">
              {hasBreakoutWatches && nonBreakoutWatchesByTicker.length > 0 ? (
                <p className="text-[11px] font-medium text-ocean-sand">Other rule watches</p>
              ) : null}
              {nonBreakoutWatchesByTicker.map((group) => {
                const tone = groupStatusTone(group.watches);
                const name = tickerNameBySymbol.get(group.symbol);
                const activeCount = group.watches.filter(
                  (w) =>
                    w.status === "running" ||
                    w.status === "checking" ||
                    w.status === "in_trade",
                ).length;
                return (
                  <section
                    key={group.symbol}
                    className={cn(
                      "rounded-lg border px-3 py-2.5",
                      tone === "met"
                        ? "border-ocean-teal/45 bg-ocean-teal/5"
                        : tone === "exit"
                          ? "border-amber-500/40 bg-amber-500/5"
                          : tone === "in_trade"
                            ? "border-sky-500/35 bg-sky-500/5"
                            : "border-ocean-mid/35 bg-ocean-deep/15",
                    )}
                    aria-labelledby={`alarm-ticker-${group.symbol}`}
                  >
                    <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-ocean-mid/25 pb-2">
                      <div className="min-w-0">
                        <h3
                          id={`alarm-ticker-${group.symbol}`}
                          className="text-sm font-semibold tabular-nums text-ocean-foam"
                        >
                          {group.symbol}
                          {name ? (
                            <span className="ml-2 text-xs font-normal text-ocean-sand">
                              {name}
                            </span>
                          ) : null}
                        </h3>
                      </div>
                      <p className="text-[11px] text-ocean-sand">
                        {group.watches.length} watch
                        {group.watches.length === 1 ? "" : "es"}
                        {activeCount > 0 ? ` · ${activeCount} active` : ""}
                      </p>
                    </header>
                    <ul className="space-y-2">
                      {group.watches.map((w) => {
                        const polling =
                          w.status === "running" ||
                          w.status === "checking" ||
                          w.status === "in_trade";
                        const awaitingUser = w.status === "met" || w.status === "exit";
                        return (
                          <li
                            key={w.id}
                            className={cn(
                              "rounded-md border px-3 py-2.5",
                              w.status === "met"
                                ? "border-ocean-teal/50 bg-ocean-teal/10"
                                : w.status === "exit"
                                  ? "border-amber-500/50 bg-amber-500/10"
                                  : w.status === "in_trade"
                                    ? "border-sky-500/40 bg-sky-500/10"
                                    : "border-ocean-mid/30 bg-ocean-surface/40",
                            )}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-ocean-foam">
                                  {w.ruleLabel}
                                  <span className="font-normal text-ocean-sand">
                                    {w.bandTimeframe ? ` · ${w.bandTimeframe} candle+BB` : ""} ·{" "}
                                    {w.trend === "auto"
                                      ? w.lastDetectedTrend === "alcista" ||
                                        w.lastDetectedTrend === "bajista"
                                        ? `Auto → ${formatAlarmTrend(w.lastDetectedTrend)}`
                                        : "Auto (both)"
                                      : formatAlarmTrend(w.trend)}
                                  </span>
                                </p>
                                <p className="mt-0.5 text-[11px] text-ocean-sand">
                                  {statusLabel(w.status)}
                                  {w.lastRuleStatus ? ` · ${w.lastRuleStatus}` : ""}
                                  {typeof w.lastBreakoutScore === "number"
                                    ? ` · score ${Math.round(w.lastBreakoutScore)}`
                                    : ""}
                                  {w.lastCheckedAt
                                    ? ` · ${new Date(w.lastCheckedAt).toLocaleTimeString()}`
                                    : ""}
                                </p>
                                {w.lastEvidence ? (
                                  <p className="mt-1 text-[11px] text-ocean-sand/90">
                                    {w.lastEvidence}
                                  </p>
                                ) : null}
                                {w.lastRuleResults && w.lastRuleResults.length > 1 ? (
                                  <ul className="mt-1 space-y-0.5 text-[11px] text-ocean-sand/80">
                                    {w.lastRuleResults.map((rr) => (
                                      <li key={rr.ruleKey}>
                                        <span
                                          className={
                                            rr.met || rr.status === "met"
                                              ? "text-ocean-teal-dim dark:text-ocean-teal"
                                              : ""
                                          }
                                        >
                                          {rr.ruleKey}: {rr.status}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                                {w.exitEvidence && w.status === "exit" ? (
                                  <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-100/90">
                                    {w.exitEvidence}
                                  </p>
                                ) : null}
                                {w.lastError ? (
                                  <p className="mt-1 text-[11px] text-ocean-danger">
                                    {w.lastError}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {polling ? (
                                  <button
                                    type="button"
                                    className={cn(
                                      BTN,
                                      "border border-ocean-mid/50 text-ocean-foam hover:bg-ocean-mid/20",
                                    )}
                                    disabled={w.status === "checking"}
                                    onClick={() => onCheckNow(w.id)}
                                  >
                                    Check now
                                  </button>
                                ) : null}
                                {w.status === "met" ? (
                                  <button
                                    type="button"
                                    className={cn(
                                      BTN,
                                      "bg-ocean-teal text-ocean-deep hover:brightness-110",
                                    )}
                                    onClick={() => onConfirmEnter(w.id)}
                                  >
                                    Entered — watch exit
                                  </button>
                                ) : null}
                                {w.status === "exit" ? (
                                  <button
                                    type="button"
                                    className={cn(
                                      BTN,
                                      "bg-amber-500 text-ocean-deep hover:brightness-110",
                                    )}
                                    onClick={() => onConfirmExit(w.id)}
                                  >
                                    Exited — arm again
                                  </button>
                                ) : null}
                                {awaitingUser || w.status === "in_trade" ? (
                                  <button
                                    type="button"
                                    className={cn(
                                      BTN,
                                      "border border-ocean-mid/40 text-ocean-sand",
                                    )}
                                    onClick={() => onClearMetStatus(w.id)}
                                    title="Reset without arming"
                                  >
                                    Clear
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className={cn(
                                    BTN,
                                    "border border-ocean-danger/50 text-ocean-danger hover:bg-ocean-danger/10",
                                  )}
                                  onClick={() => onRemove(w.id)}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>

                            {!awaitingUser ? (
                              <div className="mt-2 border-t border-ocean-mid/20 pt-2">
                                <PollControls
                                  density="compact"
                                  monitorActive={polling}
                                  canStop={polling}
                                  startPending={w.status === "checking"}
                                  intervalValue={w.frequencyValue}
                                  intervalUnit={
                                    w.frequencyUnit === "hour"
                                      ? "hour"
                                      : w.frequencyUnit === "sec"
                                        ? "sec"
                                        : "min"
                                  }
                                  units={["min", "sec", "hour"]}
                                  onIntervalValueChange={(v) =>
                                    onUpdateInterval(w.id, v, w.frequencyUnit)
                                  }
                                  onIntervalUnitChange={(u) =>
                                    onUpdateInterval(w.id, w.frequencyValue, u)
                                  }
                                  onStart={() => onStart(w.id)}
                                  onStop={() => onStop(w.id)}
                                  startDisabled={polling}
                                  intervalDisabled={false}
                                  intervalInputId={`alarm-interval-${w.id}`}
                                  monitoringMessage={
                                    polling
                                      ? `${w.status === "in_trade" ? "Exit watch" : "Enter watch"} ${w.symbol} · ${w.ruleLabel}`
                                      : null
                                  }
                                  ariaLabel={`Alarm poll ${w.symbol}`}
                                />
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
            </>
          )}
        </div>
      </section>

      {alarmPopup ? (
        <AlarmTradeModal
          watch={alarmPopup.watch}
          kind={alarmPopup.kind}
          onClose={onClearAlarmPopup}
          onConfirm={() =>
            alarmPopup.kind === "enter"
              ? onConfirmEnter(alarmPopup.watch.id)
              : onConfirmExit(alarmPopup.watch.id)
          }
        />
      ) : null}
    </>
  );
}
