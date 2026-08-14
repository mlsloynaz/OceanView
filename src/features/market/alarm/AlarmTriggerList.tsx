import { cn } from "@/shared/lib/cn";
import { useCallback, useEffect, useState } from "react";
import {
  ALARM_TRIGGER_LOG_CHANGED_EVENT,
  clearAlarmTriggerLog,
  loadAlarmTriggerLog,
  type AlarmTriggerEntry,
} from "./alarm-trigger-log";
import { formatAlarmTrend } from "./alarm-types";

const BTN =
  "rounded-md px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AlarmTriggerList() {
  const [entries, setEntries] = useState<AlarmTriggerEntry[]>([]);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await loadAlarmTriggerLog();
      setEntries(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Alarm list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    try {
      localStorage.removeItem("oceanview.market.alarm.triggers");
    } catch {
      /* ignore */
    }
    const sync = () => void refresh();
    window.addEventListener(ALARM_TRIGGER_LOG_CHANGED_EVENT, sync);
    return () => window.removeEventListener(ALARM_TRIGGER_LOG_CHANGED_EVENT, sync);
  }, [refresh]);

  return (
    <section
      className="rounded-md border border-amber-500/35 bg-amber-500/5 px-3 py-2.5"
      aria-labelledby="alarm-trigger-list-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <h3 id="alarm-trigger-list-title" className="text-xs font-semibold text-ocean-foam">
            Alarm list
            <span className="ml-1.5 font-normal text-ocean-sand">
              ({entries.length} trigger{entries.length === 1 ? "" : "s"})
            </span>
          </h3>
          <p className="mt-0.5 text-[10px] leading-snug text-ocean-sand">
            Saved in Dynamo (JobsStatus · market_alarm_triggers) with way + time. Sound + popup
            still fire on confirmation; this list keeps the history after you dismiss.
          </p>
        </button>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={cn(BTN, "border border-ocean-mid/50 text-ocean-foam")}
            disabled={loading || busy}
            onClick={() => void refresh()}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          {entries.length > 0 ? (
            <button
              type="button"
              className={cn(BTN, "border border-ocean-mid/50 text-ocean-sand")}
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void clearAlarmTriggerLog()
                  .then(() => setEntries([]))
                  .catch((err) =>
                    setError(err instanceof Error ? err.message : "Clear failed."),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              Clear list
            </button>
          ) : null}
          <button
            type="button"
            className={cn(BTN, "border border-ocean-mid/50 text-ocean-foam")}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-2 text-[11px] text-rose-300" role="status">
          {error}
        </p>
      ) : null}

      {open ? (
        loading && entries.length === 0 ? (
          <p className="mt-2 text-[11px] text-ocean-sand">Loading Alarm list…</p>
        ) : entries.length === 0 ? (
          <p className="mt-2 text-[11px] text-ocean-sand">
            No triggers yet. When a confirmation (or exit) fires, it lands here with time and way.
          </p>
        ) : (
          <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
            {entries.map((row) => (
              <li
                key={row.id}
                className="rounded border border-ocean-mid/25 bg-ocean-deep/25 px-2.5 py-1.5 text-[11px] leading-snug"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold tabular-nums text-ocean-foam">
                    {row.symbol}
                    <span
                      className={cn(
                        "ml-1.5 rounded px-1 py-0.5 text-[10px] font-medium",
                        row.kind === "enter"
                          ? "bg-ocean-teal/20 text-ocean-teal-dim dark:text-ocean-teal"
                          : "bg-amber-500/20 text-amber-900 dark:text-amber-100",
                      )}
                    >
                      {row.kind === "enter" ? "ENTER" : "EXIT"}
                    </span>
                    <span className="ml-1.5 font-normal text-ocean-sand">
                      {row.side === "alcista" || row.side === "bajista"
                        ? formatAlarmTrend(row.side)
                        : ""}
                    </span>
                  </p>
                  <time
                    className="shrink-0 tabular-nums text-[10px] text-ocean-sand"
                    dateTime={row.triggeredAt}
                  >
                    {formatWhen(row.triggeredAt)}
                  </time>
                </div>
                <p className="mt-0.5 text-ocean-sand">{row.way}</p>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
