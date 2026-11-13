import { useCallback, useEffect, useState } from "react";
import { cn } from "@/shared/lib/cn";
import type { CatalogTicker } from "@/features/admin/tickers/types";
import {
  evaluateBoardHistory,
  fetchActiveMovements,
  putActiveMovements,
  setMovementWatchLive,
  type BoardHistoryMatch,
  type MovementWatchJobStatus,
} from "./alarm-client";
import { ActiveTickerBoard, type BoardSnapshotView } from "./ActiveTickerBoard";
import { AlarmSignalStrip, alarmStripTags, type AlarmStripTag } from "./AlarmSignalStrip";
import { entryClock } from "./five-minute-entry";
import { useAlarms } from "@/features/alarms/AlarmsProvider";

function regularHoursNow(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = value("weekday");
  if (weekday === "Sat" || weekday === "Sun") return false;
  const minutes = Number(value("hour")) * 60 + Number(value("minute"));
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const DEFAULT_ELIGIBLE = [
  "trend_change_5m",
  "trend_change_15m",
  "ema_cross_5m",
] as const;

const HOUR_BLOCK_NOTE =
  "This switch applies to confirmed 5m trend change and 15m trend change. Off still records those entries and keeps the detected 1h trend. Early 5m continuation and reversal always block a strong opposite 1h trend.";

function simulationNote(matches: BoardHistoryMatch[]): string {
  const met = matches.filter((match) => match.met);
  if (met.length > 0) {
    const text = met.map((match) => match.evidence || match.ruleKey || "movement").join(" · ");
    return `Alarm · ${text}`;
  }
  const reason = matches.map((match) => match.evidence).find((evidence) => evidence);
  return reason ? `No alarm · ${reason}` : "Simulation only · no movement";
}

function simulationTag(symbol: string, row: {
  entrySide?: "CALL" | "PUT" | null;
  entryAt?: string | null;
  matches?: BoardHistoryMatch[];
}): AlarmStripTag | null {
  const met = (row.matches ?? []).filter((match) => match.met);
  if (met.length === 0) return null;
  const evidence = met.map((match) => match.evidence || "").join(" ");
  const side = row.entrySide;
  return {
    id: `${symbol}-simulation`,
    symbol,
    operation: side === "PUT" ? "Buy Put" : side === "CALL" ? "Buy Call" : "Alarm",
    earningPct: null,
    lane: "trend",
    validAt: row.entryAt ? entryClock(row.entryAt) : null,
    priority: /top priority/i.test(evidence),
  };
}

function asReviewBars(body: unknown): BoardSnapshotView["bySymbol"][string]["panes"]["5m"] {
  if (!Array.isArray(body)) return [];
  return body.flatMap((point) => {
    if (!point || typeof point !== "object") return [];
    const row = point as { datetime?: string; open?: number; high?: number; low?: number; close?: number; bbUpper?: number | null; bbMid?: number | null; bbLower?: number | null; ema10?: number | null; ema21?: number | null };
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
      },
    ];
  });
}

function statusTone(status: string): string {
  if (status === "running") return "border-amber-500/40 bg-amber-500/10";
  if (status === "cancelled") return "border-ocean-danger/40 bg-ocean-danger/5";
  return "border-ocean-mid/40 bg-ocean-surface/60";
}

export function MovementWatchNotices({ job }: { job: MovementWatchJobStatus | null }) {
  if (!job?.schwabAuthError && !job?.cycleMissed) return null;
  return (
    <div className="space-y-1">
      {job.schwabAuthError ? (
        <p
          role="alert"
          className="rounded-md border border-ocean-danger/50 bg-ocean-danger/10 px-2 py-1 text-[11px] font-semibold text-ocean-danger"
        >
          {job.schwabAuthError}
        </p>
      ) : null}
      {job.cycleMissed ? (
        <p
          role="alert"
          className="rounded-md border border-amber-400/50 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-200"
        >
          {job.cycleMissedNote || "A cycle was missed. The next check has started."}
        </p>
      ) : null}
    </div>
  );
}

type Props = {
  job: MovementWatchJobStatus | null;
  tickers: CatalogTicker[];
  tickersLoading?: boolean;
  /** After start/stop/catalog change — parent refreshes watches. */
  onJobChange: (job: MovementWatchJobStatus) => void;
  /** Start breakout alarms for the active tickers. */
  onTrackBreakout?: (symbols: string[]) => void;
  onStopBreakout?: () => void;
  breakoutRunning?: boolean;
};

export function MovementWatchPanel({
  job,
  tickers,
  tickersLoading,
  onJobChange,
  onTrackBreakout,
  onStopBreakout,
  breakoutRunning = false,
}: Props) {
  void onTrackBreakout;
  void onStopBreakout;
  void breakoutRunning;
  const jobStatus = job?.status ?? "idle";
  const sessionOpen = typeof job?.marketOpen === "boolean" ? job.marketOpen : regularHoursNow();
  const premarket = job?.premarket === true;
  const live = (sessionOpen || premarket) && (Boolean(job?.live) || jobStatus === "running");
  const finishing = Boolean(job?.cycleBusy) && jobStatus !== "running";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [blockHour, setBlockHour] = useState(false);
  const [hourBlockNote, setHourBlockNote] = useState(HOUR_BLOCK_NOTE);
  const [refreshKey, setRefreshKey] = useState(0);
  const [throughEt, setThroughEt] = useState("");
  const [review, setReview] = useState<BoardSnapshotView | null>(null);
  const [reviewTags, setReviewTags] = useState<AlarmStripTag[]>([]);
  const [windowBlocked, setWindowBlocked] = useState(false);
  const alarms = useAlarms();

  const loadCatalog = useCallback(async () => {
    try {
      const payload = await fetchActiveMovements();
      setBlockHour(Boolean(payload.hourRegimeBlock));
      setHourBlockNote(payload.hourRegimeBlockNote || HOUR_BLOCK_NOTE);
      setCatalogLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load active movements.");
      setCatalogLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (sessionOpen) {
      setReview(null);
      setReviewTags([]);
    }
  }, [sessionOpen]);

  useEffect(() => {
    if (!live) return;
    setReview(null);
    setReviewTags([]);
    setRefreshKey((value) => value + 1);
    const timer = window.setInterval(() => setRefreshKey((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, [live]);

  const toggleLive = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await setMovementWatchLive(!live);
      onJobChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change Live.");
    } finally {
      setBusy(false);
    }
  };

  const runHistory = async () => {
    if (!throughEt) {
      setError("Pick the end of the four-hour window.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = await evaluateBoardHistory(new Date(throughEt).toISOString());
      const bySymbol: BoardSnapshotView["bySymbol"] = {};
      const tags: AlarmStripTag[] = [];
      for (const [symbol, row] of Object.entries(payload.symbols ?? {})) {
        const entrySide = row.entrySide === "CALL" || row.entrySide === "PUT" ? row.entrySide : null;
        const tag = simulationTag(symbol, { ...row, entrySide });
        if (tag) tags.push(tag);
        bySymbol[symbol] = {
          error: row.error,
          panes: {
            "5m": asReviewBars(row.panes?.["5m"]),
            "15m": asReviewBars(row.panes?.["15m"]),
            "1m": asReviewBars(row.panes?.["1m"]),
          },
          note: simulationNote(row.matches ?? []),
          hourRelation: row.hourRelation,
          hourRegime: row.hourRegime,
          entryAt: row.entryAt,
          entrySide,
        };
      }
      setReviewTags(tags);
      setReview({
        label: "Simulation only · Alpaca IEX",
        windowStartEt: payload.windowStartEt,
        windowEndEt: payload.windowEndEt,
        bySymbol,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Historical check failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleBlockChange = async (checked: boolean) => {
    setBlockHour(checked);
    setBusy(true);
    setError(null);
    try {
      const keys = job?.ruleKeys?.length ? job.ruleKeys : [...DEFAULT_ELIGIBLE];
      const payload = await putActiveMovements(keys, checked);
      setBlockHour(Boolean(payload.hourRegimeBlock));
      setHourBlockNote(payload.hourRegimeBlockNote || HOUR_BLOCK_NOTE);
    } catch (err) {
      setBlockHour(!checked);
      setError(err instanceof Error ? err.message : "Failed to save the 1h block.");
    } finally {
      setBusy(false);
    }
  };

  const boardTickers = tickers
    .filter((ticker) => ticker.active !== false)
    .map((ticker) => ({
      symbol: ticker.symbol.trim().toUpperCase(),
      name: ticker.name ?? undefined,
    }))
    .filter((ticker) => ticker.symbol);

  return (
    <section
      className="space-y-3 rounded-xl border border-ocean-mid/50 bg-ocean-deep/30 p-3"
      aria-label="Movement Watch"
    >
      <div>
        <h3 className="text-sm font-semibold text-ocean-foam">Movement Watch</h3>
        <p className="mt-0.5 text-[11px] text-ocean-sand">
          One grid, graphs on all the time. During regular hours, Live collects Schwab
          chart data and both movement checks, paints these thumbnails, and rings alarms.
          Live turns off at the close. After that, pick a date and time to evaluate that
          window from Alpaca. Those results stay on this grid and are not live alerts.
        </p>
      </div>

      <label className="flex items-start gap-2 text-xs text-ocean-foam">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={blockHour}
          disabled={busy || !catalogLoaded}
          onChange={(event) => void handleBlockChange(event.target.checked)}
        />
        <span>
          Block confirmed entries against the 1h trend
          <span className="mt-0.5 block text-[11px] font-normal text-ocean-sand">
            {hourBlockNote}
          </span>
        </span>
      </label>

      <div className={cn("space-y-2 rounded-lg border px-3 py-2.5", statusTone(jobStatus))}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-[11px] text-ocean-sand">
            Status: <span className="capitalize text-ocean-foam">{jobStatus}</span>
            {typeof job?.activeTickerCount === "number"
              ? ` · ${job.activeTickerCount} tickers`
              : ` · ${boardTickers.length} active tickers`}
          </p>
          <button
            type="button"
            className={cn(
              BTN,
              live ? "bg-rose-500 text-white" : "border border-ocean-mid/40 text-ocean-foam",
            )}
            onClick={() => void toggleLive()}
            disabled={busy || (!sessionOpen && !premarket)}
            title={
              sessionOpen
                ? "Collect Schwab charts and alarms"
                : premarket
                  ? "Alpaca last price on the 5m chart"
                  : "Live is available in premarket and regular hours"
            }
          >
            {live ? "LIVE" : "Live"}
          </button>
        </div>
        {finishing ? (
          <p className="text-[11px] leading-snug text-ocean-sand">
            Finishing the current cycle. This pass can still record.
          </p>
        ) : null}
        {job?.message ? (
          <p className="text-[11px] leading-snug text-ocean-sand">{job.message}</p>
        ) : null}
        <MovementWatchNotices job={job} />
      </div>

      {sessionOpen ? null : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[11px] text-ocean-sand">
            Simulate window ending
            <input
              type="datetime-local"
              value={throughEt}
              onChange={(event) => setThroughEt(event.target.value)}
              className="mt-1 block rounded-md border border-ocean-mid/40 bg-ocean-deep px-2 py-1 text-[11px] text-ocean-foam"
            />
          </label>
          <button
            type="button"
            className={cn(BTN, "border border-ocean-mid/40 text-ocean-foam")}
            disabled={busy}
            onClick={() => void runHistory()}
          >
            Simulate
          </button>
          {review ? (
            <button
              type="button"
              className={cn(BTN, "border border-ocean-mid/40 text-ocean-sand")}
              onClick={() => {
                setReview(null);
                setReviewTags([]);
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-ocean-foam">
            Active tickers ({boardTickers.length})
            {live ? " · 1m updates every 30s" : ""}
          </p>
          <button
            type="button"
            className={cn(BTN, "border border-ocean-mid/40 text-ocean-foam")}
            onClick={() => {
              const opened = window.open(
                `${window.location.origin}/alarms/thumbnails`,
                "oceanview-thumbnail-grid",
                "popup=yes,width=1600,height=1000",
              );
              if (!opened || opened.closed) {
                setWindowBlocked(true);
                return;
              }
              setWindowBlocked(false);
              opened.focus();
            }}
          >
            Open full screen
          </button>
        </div>
        {windowBlocked ? (
          <p className="text-[11px] text-ocean-sand">Allow pop-ups for OceanView to open the thumbnail window.</p>
        ) : null}
        <AlarmSignalStrip tags={alarmStripTags(alarms.alarmPopup)} onClose={alarms.dismissAlarmPopup} />
        {tickersLoading ? (
          <p className="text-[11px] text-ocean-sand">Loading tickers…</p>
        ) : (
          <ActiveTickerBoard
            tickers={boardTickers}
            refreshKey={refreshKey}
            live={live}
            review={review}
            alertTags={review ? reviewTags : alarmStripTags(alarms.alarmPopup)}
          />
        )}
      </div>

      {error ? (
        <p className="text-xs text-ocean-danger" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
