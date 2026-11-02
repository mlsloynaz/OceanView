import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/shared/lib/cn";
import type { CatalogTicker } from "@/features/admin/tickers/types";
import {
  fetchActiveMovements,
  putActiveMovements,
  startMovementWatchJob,
  stopMovementWatchJob,
  type MovementWatchJobStatus,
} from "./alarm-client";
import { ActiveTickerBoard } from "./ActiveTickerBoard";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const DEFAULT_ELIGIBLE = [
  "trend_change_5m",
  "trend_change_15m",
  "ema_cross_5m",
] as const;

const HOUR_BLOCK_NOTE =
  "This switch applies to confirmed 5m trend change and 15m trend change. Off still records those entries and keeps the detected 1h trend. Early 5m continuation and reversal always block a strong opposite 1h trend.";

function statusTone(status: string): string {
  if (status === "running") return "border-amber-500/40 bg-amber-500/10";
  if (status === "cancelled") return "border-ocean-danger/40 bg-ocean-danger/5";
  return "border-ocean-mid/40 bg-ocean-surface/60";
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
  const jobStatus = job?.status ?? "idle";
  const running = jobStatus === "running";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [blockHour, setBlockHour] = useState(false);
  const [hourBlockNote, setHourBlockNote] = useState(HOUR_BLOCK_NOTE);
  const [live, setLive] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const activeTickers = useMemo(
    () =>
      tickers
        .filter((t) => t.active !== false)
        .map((t) => t.symbol.trim().toUpperCase())
        .filter(Boolean),
    [tickers],
  );

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
    if (!live) return;
    setRefreshKey((value) => value + 1);
    const timer = window.setInterval(() => setRefreshKey((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, [live]);

  const runningKeys = running ? [...(job?.ruleKeys ?? [])] : [];
  const tracking5m = runningKeys.includes("trend_change_5m");

  const saveMovements = async (keys: string[]) => {
    const payload = await putActiveMovements(keys);
    return payload.ruleKeys;
  };

  const startRule = async (key: string) => {
    setBusy(true);
    setError(null);
    try {
      if (key === "breakout_quality") {
        if (activeTickers.length === 0) {
          setError("No active tickers.");
          return;
        }
        onTrackBreakout?.(activeTickers);
        return;
      }
      const keys = [...new Set([...runningKeys, key])];
      await saveMovements(keys);
      const next = await startMovementWatchJob({ trigger: "manual", ruleKeys: keys });
      onJobChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start tracking.");
    } finally {
      setBusy(false);
    }
  };

  const stopRule = async (key: string) => {
    setBusy(true);
    setError(null);
    try {
      if (key === "breakout_quality") {
        onStopBreakout?.();
        return;
      }
      const keys = runningKeys.filter((item) => item !== key);
      if (keys.length === 0) {
        const next = await stopMovementWatchJob("cancelled");
        onJobChange(next);
        return;
      }
      await saveMovements(keys);
      const next = await startMovementWatchJob({ trigger: "manual", ruleKeys: keys });
      onJobChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop tracking.");
    } finally {
      setBusy(false);
    }
  };

  const handleBlockChange = async (checked: boolean) => {
    setBlockHour(checked);
    setBusy(true);
    setError(null);
    try {
      const keys = runningKeys.length > 0 ? runningKeys : [...DEFAULT_ELIGIBLE];
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

  const trackRows = [
    { key: "trend_change_5m", label: "5m trend change", on: tracking5m },
    { key: "breakout_quality", label: "Breakout", on: breakoutRunning },
  ];

  return (
    <section
      className="space-y-3 rounded-xl border border-ocean-mid/50 bg-ocean-deep/30 p-3"
      aria-label="Movement Watch"
    >
      <div>
        <h3 className="text-sm font-semibold text-ocean-foam">Movement Watch</h3>
        <p className="mt-0.5 text-[11px] text-ocean-sand">
          Charts stay on the active tickers with no alarm running. Start on a row to
          track that alarm and send notifications. Live refreshes the candles every minute.
          When the market is closed, the charts show the previous session.
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
              : ` · ${activeTickers.length} active tickers`}
          </p>
          <button
            type="button"
            className={cn(
              BTN,
              live ? "bg-rose-500 text-white" : "border border-ocean-mid/40 text-ocean-foam",
            )}
            onClick={() => setLive((value) => !value)}
          >
            {live ? "LIVE" : "Live"}
          </button>
        </div>
        {job?.message ? (
          <p className="text-[11px] leading-snug text-ocean-sand">{job.message}</p>
        ) : null}
      </div>

      <ul className="space-y-1 rounded-md border border-ocean-mid/40 bg-ocean-surface/40 px-2 py-1.5">
        {trackRows.map((row) => (
          <li key={row.key} className="flex items-center justify-between gap-2 py-1">
            <span className="text-sm font-medium text-ocean-foam">{row.label}</span>
            {row.on ? (
              <button
                type="button"
                className={cn(BTN, "border border-ocean-mid/40 text-ocean-sand")}
                disabled={busy}
                onClick={() => void stopRule(row.key)}
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                className={cn(BTN, "bg-ocean-teal text-ocean-deep")}
                disabled={busy || activeTickers.length === 0}
                onClick={() => void startRule(row.key)}
              >
                Start
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-ocean-foam">
          Active tickers ({boardTickers.length})
          {live ? " · updating every minute" : ""}
        </p>
        {tickersLoading ? (
          <p className="text-[11px] text-ocean-sand">Loading tickers…</p>
        ) : (
          <ActiveTickerBoard tickers={boardTickers} refreshKey={refreshKey} />
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
