import { useState } from "react";
import { CollapsibleSection } from "@/shared/components/CollapsibleSection";
import { PollControls, type PollIntervalUnit } from "@/shared/components/PollControls";
import { cn } from "@/shared/lib/cn";
import type { CatalogTicker } from "@/features/admin/tickers/types";
import { AlarmMetModal } from "./AlarmMetModal";
import {
  ALARM_ELIGIBLE_RULES,
  formatAlarmTrend,
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
    symbol: string;
    ruleKey: AlarmEligibleRuleKey;
    trend: AlarmTrend;
    frequencyValue: number;
    frequencyUnit: PollIntervalUnit;
  }) => boolean;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
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
  onRemove,
  onCheckNow,
  onUpdateInterval,
  onRequestNotify,
}: Props) {
  const [open, setOpen] = useState(true);
  const [symbol, setSymbol] = useState("");
  const [ruleKey, setRuleKey] = useState<AlarmEligibleRuleKey>("candle_confirm_1h");
  const [trend, setTrend] = useState<AlarmTrend>("alcista");
  const [frequencyValue, setFrequencyValue] = useState(5);
  const [frequencyUnit, setFrequencyUnit] = useState<PollIntervalUnit>("min");

  const subtitle =
    metCount > 0
      ? `${metCount} alarm${metCount === 1 ? "" : "s"} fired · ${runningCount} polling`
      : runningCount > 0
        ? `${runningCount} watch${runningCount === 1 ? "" : "es"} polling`
        : "Pick ticker + confirmation candle (1h / 15m) + trend · Start polls until met";

  return (
    <>
      <CollapsibleSection
        id="market-alarms"
        title="Rule Alarm"
        subtitle={subtitle}
        open={open}
        onOpenChange={setOpen}
        className="min-w-0 border-ocean-teal/35 bg-ocean-deep/20"
      >
        <div className="space-y-3 text-sm">
          <p className="text-xs leading-relaxed text-ocean-sand">
            Moved here from Premarket. Watch an active ticker until the confirmation candle rule
            is <span className="font-medium text-ocean-foam">met</span> for the chosen trend
            (popup + bell). Expand this section if collapsed.
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
            Eligible rules: confirmation candle 1h / 15m. Pick ticker, rule, and trend (alcista or
            bajista). Start polls until the rule is met — then a popup and bell fire and polling
            stops.
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
                symbol,
                ruleKey,
                trend,
                frequencyValue,
                frequencyUnit,
              });
              if (ok) setSymbol("");
            }}
          >
            <label className="flex flex-col gap-1 text-xs text-ocean-sand lg:col-span-2">
              Ticker
              <select
                className="rounded-md border border-ocean-mid/40 bg-ocean-surface px-2 py-1.5 text-sm text-ocean-foam"
                value={symbol}
                disabled={tickersLoading}
                onChange={(e) => setSymbol(e.target.value)}
                required
              >
                <option value="">{tickersLoading ? "Loading…" : "Select ticker"}</option>
                {tickers.map((t) => (
                  <option key={t.symbol} value={t.symbol}>
                    {t.symbol}
                    {t.name ? ` — ${t.name}` : ""}
                  </option>
                ))}
              </select>
            </label>

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

            <div className="flex items-end lg:col-span-6">
              <button
                type="submit"
                className={cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-110")}
                disabled={tickers.length === 0}
              >
                Add watch
              </button>
            </div>
          </form>

          {(formError || tickersError) && (
            <p className="text-xs text-ocean-danger" role="alert">
              {formError || tickersError}
            </p>
          )}

          {watches.length === 0 ? (
            <p className="text-xs text-ocean-sand">
              No watches yet — add a ticker + rule + trend above.
            </p>
          ) : (
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
                            · {w.ruleLabel} · {formatAlarmTrend(w.trend)}
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
          )}
        </div>
      </CollapsibleSection>

      {metPopup ? <AlarmMetModal watch={metPopup} onClose={onClearMetPopup} /> : null}
    </>
  );
}
