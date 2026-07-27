import { useState } from "react";
import {
  PollControls,
  clampPollInterval,
  type PollIntervalUnit,
} from "@/shared/components/PollControls";
import { cn } from "@/shared/lib/cn";
import type { CatalogTicker } from "@/features/admin/tickers/types";
import { AlarmMetModal } from "./AlarmMetModal";
import {
  ALARM_ELIGIBLE_RULES,
  formatAlarmTrend,
  needsBandTimeframe,
  type AlarmBandTimeframe,
  type AlarmEligibleRuleKey,
  type AlarmTrend,
  type MarketAlarmWatch,
} from "./alarm-types";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  watches: MarketAlarmWatch[];
  tickers: CatalogTicker[];
  tickersLoading: boolean;
  tickersError: string | null;
  formError: string | null;
  banner: string | null;
  metPopup: MarketAlarmWatch | null;
  metCount: number;
  runningCount: number;
  onClearBanner: () => void;
  onClearMetPopup: () => void;
  onAdd: (input: {
    symbols: string[];
    ruleKey: AlarmEligibleRuleKey;
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
  onRemove: (id: string) => void;
  onCheckNow: (id: string) => void;
  onUpdateInterval: (id: string, value: number, unit: PollIntervalUnit) => void;
  onRequestNotify: () => void;
};

function statusLabel(status: MarketAlarmWatch["status"]): string {
  switch (status) {
    case "running":
      return "Polling";
    case "checking":
      return "Checking…";
    case "met":
      return "Met — stopped";
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
  metPopup,
  metCount,
  runningCount,
  onClearBanner,
  onClearMetPopup,
  onAdd,
  onStart,
  onStop,
  onStartAllIdle,
  onStopAllRunning,
  onRemove,
  onCheckNow,
  onUpdateInterval,
  onRequestNotify,
}: Props) {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [ruleKey, setRuleKey] = useState<AlarmEligibleRuleKey>("candle_confirm_1h");
  const [trend, setTrend] = useState<AlarmTrend>("alcista");
  const [bandTimeframe, setBandTimeframe] = useState<AlarmBandTimeframe>("1m");
  const [frequencyValue, setFrequencyValue] = useState(5);
  const [frequencyUnit, setFrequencyUnit] = useState<PollIntervalUnit>("min");
  const showBandTf = needsBandTimeframe(ruleKey);

  const setIntervalValue = (raw: number) => {
    setFrequencyValue(clampPollInterval(raw, frequencyUnit));
  };
  const setIntervalUnit = (unit: PollIntervalUnit) => {
    setFrequencyUnit(unit);
    setFrequencyValue((v) => clampPollInterval(v, unit));
  };

  const allSelected =
    tickers.length > 0 && selectedSymbols.length > 0 && selectedSymbols.length === tickers.length;

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
      ? `${metCount} alarm${metCount === 1 ? "" : "s"} fired · ${runningCount} polling`
      : runningCount > 0
        ? `${runningCount} watch${runningCount === 1 ? "" : "es"} polling`
        : "Pick tickers + rule + trend + interval · Start polls until met";

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
            Watch an active ticker until an eligible rule is{" "}
            <span className="font-medium text-ocean-foam">met</span> for the chosen trend
            (popup + bell). Set how often to check below (sec / min / hour).
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
            Eligible: confirmation candle 1h / 15m, or Disipador touch (candle + BB on the
            Timeframe you pick: 1m / 15m / 1h). Alarm fires on the{" "}
            <strong className="font-medium text-ocean-foam">first</strong> touch/pass only;
            no touch or 2+ consecutive (including ≥3) = not met. Select tickers (or{" "}
            <strong className="font-medium text-ocean-foam">Select all</strong>), rule, trend, and
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

          <form
            className="grid gap-2 rounded-md border border-ocean-mid/30 bg-ocean-deep/20 p-3 sm:grid-cols-2 lg:grid-cols-6"
            onSubmit={(e) => {
              e.preventDefault();
              const ok = onAdd({
                symbols: selectedSymbols,
                ruleKey,
                trend,
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

            <label className="flex flex-col gap-1 text-xs text-ocean-sand lg:col-span-2">
              Rule
              <select
                className="rounded-md border border-ocean-mid/40 bg-ocean-surface px-2 py-1.5 text-sm text-ocean-foam"
                value={ruleKey}
                onChange={(e) => setRuleKey(e.target.value as AlarmEligibleRuleKey)}
                required
              >
                {ALARM_ELIGIBLE_RULES.map((r) => (
                  <option key={r.ruleKey} value={r.ruleKey}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

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
                  Candle and Bollinger both use this timeframe
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
                disabled={tickers.length === 0 || selectedSymbols.length === 0}
              >
                {selectedSymbols.length > 1
                  ? `Add ${selectedSymbols.length} watches`
                  : "Add watch"}
              </button>
              <button
                type="button"
                className={cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-110")}
                disabled={tickers.length === 0 || selectedSymbols.length === 0}
                onClick={() => {
                  const ok = onAdd({
                    symbols: selectedSymbols,
                    ruleKey,
                    trend,
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
              No watches yet — select tickers + rule + trend above.
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
              </div>
            <ul className="space-y-3">
              {watches.map((w) => {
                const polling = w.status === "running" || w.status === "checking";
                return (
                  <li
                    key={w.id}
                    className={cn(
                      "rounded-md border px-3 py-2.5",
                      w.status === "met"
                        ? "border-ocean-teal/50 bg-ocean-teal/10"
                        : "border-ocean-mid/30 bg-ocean-surface/40",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-ocean-foam">
                          {w.symbol}{" "}
                          <span className="font-normal text-ocean-sand">
                            · {w.ruleLabel}
                            {w.bandTimeframe ? ` · ${w.bandTimeframe} candle+BB` : ""} ·{" "}
                            {formatAlarmTrend(w.trend)}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-ocean-sand">
                          {statusLabel(w.status)}
                          {w.lastRuleStatus ? ` · ${w.lastRuleStatus}` : ""}
                          {w.lastCheckedAt
                            ? ` · ${new Date(w.lastCheckedAt).toLocaleTimeString()}`
                            : ""}
                        </p>
                        {w.lastEvidence ? (
                          <p className="mt-1 text-[11px] text-ocean-sand/90">{w.lastEvidence}</p>
                        ) : null}
                        {w.lastError ? (
                          <p className="mt-1 text-[11px] text-ocean-danger">{w.lastError}</p>
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
                        <button
                          type="button"
                          className={cn(BTN, "border border-ocean-mid/40 text-ocean-sand")}
                          onClick={() => onRemove(w.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {w.status !== "met" ? (
                      <div className="mt-2 border-t border-ocean-mid/20 pt-2">
                        <PollControls
                          density="compact"
                          monitorActive={polling}
                          canStop={polling}
                          startPending={w.status === "checking"}
                          intervalValue={w.frequencyValue}
                          intervalUnit={w.frequencyUnit === "hour" ? "hour" : w.frequencyUnit === "sec" ? "sec" : "min"}
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
                              ? `Polling ${w.symbol} · ${w.ruleLabel} · ${formatAlarmTrend(w.trend)}`
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
            </>
          )}
        </div>
      </section>

      {metPopup ? <AlarmMetModal watch={metPopup} onClose={onClearMetPopup} /> : null}
    </>
  );
}
