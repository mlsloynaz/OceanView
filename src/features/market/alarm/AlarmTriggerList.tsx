import { cn } from "@/shared/lib/cn";
import { useCallback, useEffect, useState } from "react";
import {
  ALARM_TRIGGER_LOG_CHANGED_EVENT,
  loadAlarmTriggerLog,
  type AlarmTriggerEntry,
} from "./alarm-trigger-log";

const BTN =
  "rounded-md px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

type AlarmListScope = "week" | "today" | "hour";

const HOUR_MS = 60 * 60 * 1000;

function isTodayEntry(entry: AlarmTriggerEntry, tradeDate: string | null): boolean {
  if (!tradeDate) return false;
  return (entry.tradeDate ?? "").slice(0, 10) === tradeDate;
}

function isLastHourEntry(entry: AlarmTriggerEntry, nowMs: number): boolean {
  const at = Date.parse(entry.triggeredAt);
  if (Number.isNaN(at)) return false;
  return at <= nowMs && nowMs - at <= HOUR_MS;
}

function contractSide(row: AlarmTriggerEntry): { label: "CALL" | "PUT"; up: boolean } | null {
  const side = String(row.side || "").toLowerCase();
  if (side === "alcista") return { label: "CALL", up: true };
  if (side === "bajista") return { label: "PUT", up: false };
  return null;
}

function optionGainPct(row: AlarmTriggerEntry): number | null {
  const blob = `${row.way ?? ""} ${row.evidence ?? ""}`;
  const match =
    blob.match(/estimated option gain\s+([0-9]+(?:\.[0-9]+)?)%/i) ??
    blob.match(/est\. earning\s+([0-9]+(?:\.[0-9]+)?)%/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function DirectionArrow({ up }: { up: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={cn("inline-block h-4 w-4", up ? "text-ocean-teal" : "text-amber-500")}
    >
      {up ? (
        <path d="M8 2.5 13 9H3L8 2.5Z" fill="currentColor" />
      ) : (
        <path d="M8 13.5 3 7h10L8 13.5Z" fill="currentColor" />
      )}
    </svg>
  );
}

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
  const [scope, setScope] = useState<AlarmListScope>("week");
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [tradeDate, setTradeDate] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadAlarmTriggerLog("current");
      setEntries(loaded.entries);
      setWeekStart(loaded.weekStart);
      setTradeDate(loaded.tradeDate);
      setNowMs(Date.now());
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

  useEffect(() => {
    if (scope !== "hour") return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [scope]);

  const visible = entries.filter((entry) => {
    if (scope === "today") return isTodayEntry(entry, tradeDate);
    if (scope === "hour") return isLastHourEntry(entry, nowMs);
    return true;
  });

  const scopeNote =
    scope === "week"
      ? `This week${weekStart ? ` from ${weekStart}` : ""} stays saved after you leave, so entries can be reviewed later.`
      : scope === "today"
        ? `Today${tradeDate ? ` (${tradeDate})` : ""}. This week keeps the full list.`
        : "Last hour — alarms from the past 60 minutes.";

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
              ({visible.length} trigger{visible.length === 1 ? "" : "s"})
            </span>
          </h3>
          <p className="mt-0.5 text-[10px] leading-snug text-ocean-sand">
            {scopeNote}
          </p>
        </button>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={cn(
              BTN,
              "border",
              scope === "week"
                ? "border-ocean-teal/60 text-ocean-foam"
                : "border-ocean-mid/50 text-ocean-sand",
            )}
            onClick={() => setScope("week")}
          >
            This week
          </button>
          <button
            type="button"
            className={cn(
              BTN,
              "border",
              scope === "today"
                ? "border-ocean-teal/60 text-ocean-foam"
                : "border-ocean-mid/50 text-ocean-sand",
            )}
            onClick={() => setScope("today")}
          >
            Today
          </button>
          <button
            type="button"
            className={cn(
              BTN,
              "border",
              scope === "hour"
                ? "border-ocean-teal/60 text-ocean-foam"
                : "border-ocean-mid/50 text-ocean-sand",
            )}
            onClick={() => {
              setNowMs(Date.now());
              setScope("hour");
            }}
          >
            Last hour
          </button>
          <button
            type="button"
            className={cn(BTN, "border border-ocean-mid/50 text-ocean-foam")}
            disabled={loading}
            onClick={() => void refresh()}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
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
        loading && visible.length === 0 ? (
          <p className="mt-2 text-[11px] text-ocean-sand">Loading Alarm list…</p>
        ) : visible.length === 0 ? (
          <p className="mt-2 text-[11px] text-ocean-sand">
            {scope === "today"
              ? "No triggers today."
              : scope === "hour"
                ? "No triggers in the last hour."
                : "No triggers yet. When a confirmation (or exit) fires, it lands here with time and way."}
          </p>
        ) : (
          <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
            {visible.map((row) => {
              const contract = contractSide(row);
              const gain = optionGainPct(row);
              const enter = row.kind === "enter";
              return (
              <li
                key={row.id}
                title={row.way}
                className="rounded border border-ocean-mid/25 bg-ocean-deep/25 px-2.5 py-1.5"
              >
                <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[11px] leading-snug">
                  <span className="font-semibold tabular-nums text-ocean-foam">{row.symbol}</span>
                  <span
                    className={cn(
                      "rounded px-1 py-0.5 text-[10px] font-semibold",
                      enter
                        ? "bg-ocean-teal/20 text-ocean-teal-dim dark:text-ocean-teal"
                        : "bg-amber-500/20 text-amber-900 dark:text-amber-100",
                    )}
                  >
                    {enter ? "ENTER" : "EXIT"}
                  </span>
                  {contract ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-ocean-foam">
                      <span aria-hidden>·</span>
                      {contract.label}
                      <DirectionArrow up={contract.up} />
                    </span>
                  ) : null}
                  {gain != null ? (
                    <span className="text-ocean-sand">
                      estimated option gain{" "}
                      <span className="text-xl font-bold tabular-nums leading-none text-ocean-teal">
                        {gain.toFixed(2)}%
                      </span>
                    </span>
                  ) : null}
                </p>
                <time
                  className="mt-0.5 block tabular-nums text-[10px] text-ocean-sand"
                  dateTime={row.triggeredAt}
                >
                  {formatWhen(row.triggeredAt)}
                </time>
              </li>
              );
            })}
          </ul>
        )
      ) : null}
    </section>
  );
}
