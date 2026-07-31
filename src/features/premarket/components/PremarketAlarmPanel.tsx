import { useState } from "react";
import { CollapsibleSection } from "@/shared/components/CollapsibleSection";
import { cn } from "@/shared/lib/cn";
import type { CatalogTicker } from "@/features/admin/tickers/types";
import type { DynamicStrategy } from "../api/dynamic-strategy-client";
import {
  formatAlarmFrequency,
  type AlarmFrequencyUnit,
  type PremarketAlarmWatch,
} from "../alarm-types";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  watches: PremarketAlarmWatch[];
  tickers: CatalogTicker[];
  tickersLoading: boolean;
  tickersError: string | null;
  formError: string | null;
  banner: string | null;
  activeStrategies: DynamicStrategy[];
  metCount: number;
  runningCount: number;
  thresholdPct: number;
  onClearBanner: () => void;
  onAdd: (input: {
    symbol: string;
    strategyId: string;
    frequencyValue: number;
    frequencyUnit: AlarmFrequencyUnit;
  }) => boolean;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onClearMetStatus: (id: string, opts?: { restart?: boolean }) => void;
  onClearAllMetStatuses: () => void;
  onRemove: (id: string) => void;
  onCheckNow: (id: string) => void;
  onRequestNotify: () => void;
};

function statusLabel(status: PremarketAlarmWatch["status"]): string {
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

export function PremarketAlarmPanel({
  watches,
  tickers,
  tickersLoading,
  tickersError,
  formError,
  banner,
  activeStrategies,
  metCount,
  runningCount,
  thresholdPct,
  onClearBanner,
  onAdd,
  onStart,
  onStop,
  onClearMetStatus,
  onClearAllMetStatuses,
  onRemove,
  onCheckNow,
  onRequestNotify,
}: Props) {
  const [open, setOpen] = useState(true);
  const [symbol, setSymbol] = useState("");
  const [strategyId, setStrategyId] = useState("");
  const [frequencyValue, setFrequencyValue] = useState(5);
  const [frequencyUnit, setFrequencyUnit] = useState<AlarmFrequencyUnit>("min");

  const subtitle =
    metCount > 0
      ? `${metCount} alarm${metCount === 1 ? "" : "s"} fired · ${runningCount} polling`
      : runningCount > 0
        ? `${runningCount} watch${runningCount === 1 ? "" : "es"} polling · met at ≥ ${thresholdPct}%`
        : `Custom ticker + strategy · poll candles · alarm at ≥ ${thresholdPct}%`;

  return (
    <CollapsibleSection
      id="premarket-alarms"
      title="Alarm"
      subtitle={subtitle}
      open={open}
      onOpenChange={setOpen}
      className="min-w-0"
    >
      <div className="space-y-3 text-sm">
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
          Pick a ticker and one dynamic strategy. Start polls candles on that interval; when quality
          reaches the Premarket threshold (≥ {thresholdPct}%), you get an in-app alarm and polling
          stops for that watch.
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
            Clear all met{metCount > 0 ? ` (${metCount})` : ""}
          </button>
        </div>

        <form
          className="grid gap-2 rounded-md border border-ocean-mid/30 bg-ocean-deep/20 p-3 sm:grid-cols-2 lg:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            const ok = onAdd({ symbol, strategyId, frequencyValue, frequencyUnit });
            if (ok) {
              setSymbol("");
            }
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
            Strategy
            <select
              className="rounded-md border border-ocean-mid/40 bg-ocean-surface px-2 py-1.5 text-sm text-ocean-foam"
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value)}
              required
            >
              <option value="">Select strategy</option>
              {activeStrategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-ocean-sand">
            Every
            <input
              type="number"
              min={1}
              step={1}
              className="rounded-md border border-ocean-mid/40 bg-ocean-surface px-2 py-1.5 text-sm text-ocean-foam"
              value={frequencyValue}
              onChange={(e) => setFrequencyValue(Number(e.target.value) || 1)}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-ocean-sand">
            Unit
            <select
              className="rounded-md border border-ocean-mid/40 bg-ocean-surface px-2 py-1.5 text-sm text-ocean-foam"
              value={frequencyUnit}
              onChange={(e) => setFrequencyUnit(e.target.value as AlarmFrequencyUnit)}
            >
              <option value="min">Minutes</option>
              <option value="hour">Hours</option>
            </select>
          </label>

          <div className="flex items-end lg:col-span-6">
            <button
              type="submit"
              className={cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-110")}
              disabled={activeStrategies.length === 0 || tickers.length === 0}
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
          <p className="text-xs text-ocean-sand">No watches yet — add a ticker + strategy above.</p>
        ) : (
          <ul className="space-y-2">
            {watches.map((w) => (
              <li
                key={w.id}
                className={cn(
                  "rounded-md border px-3 py-2",
                  w.status === "met"
                    ? "border-ocean-teal/50 bg-ocean-teal/10"
                    : "border-ocean-mid/30 bg-ocean-surface/40",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-ocean-foam">
                      {w.symbol}{" "}
                      <span className="font-normal text-ocean-sand">· {w.strategyName}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-ocean-sand">
                      {formatAlarmFrequency(w.frequencyValue, w.frequencyUnit)} · {statusLabel(w.status)}
                      {w.lastQualityPct != null ? ` · last ${w.lastQualityPct}%` : ""}
                      {w.lastCheckedAt
                        ? ` · ${new Date(w.lastCheckedAt).toLocaleTimeString()}`
                        : ""}
                    </p>
                    {w.lastError ? (
                      <p className="mt-1 text-[11px] text-ocean-danger">{w.lastError}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {w.status !== "met" &&
                    w.status !== "running" &&
                    w.status !== "checking" ? (
                      <button
                        type="button"
                        className={cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-110")}
                        onClick={() => onStart(w.id)}
                      >
                        Start
                      </button>
                    ) : null}
                    {(w.status === "running" || w.status === "checking") && (
                      <>
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
                      </>
                    )}
                    {w.status === "met" ? (
                      <>
                        <button
                          type="button"
                          className={cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-110")}
                          onClick={() => onClearMetStatus(w.id, { restart: true })}
                        >
                          Clear & resume
                        </button>
                        <button
                          type="button"
                          className={cn(
                            BTN,
                            "border border-ocean-teal/50 text-ocean-foam hover:bg-ocean-teal/15",
                          )}
                          onClick={() => onClearMetStatus(w.id)}
                        >
                          Clear
                        </button>
                      </>
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </CollapsibleSection>
  );
}
