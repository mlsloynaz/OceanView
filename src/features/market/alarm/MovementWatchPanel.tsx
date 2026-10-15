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
import { alarmRuleLabel } from "./alarm-types";

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
};

export function MovementWatchPanel({
  job,
  tickers,
  tickersLoading,
  onJobChange,
}: Props) {
  const jobStatus = job?.status ?? "idle";
  const running = jobStatus === "running";
  const cancelledToday = jobStatus === "cancelled";

  const [eligible, setEligible] = useState<string[]>([...DEFAULT_ELIGIBLE]);
  const [selectedMovements, setSelectedMovements] = useState<string[]>([
    ...DEFAULT_ELIGIBLE,
  ]);
  const [useAllTickers, setUseAllTickers] = useState(true);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [blockHour, setBlockHour] = useState(false);
  const [hourBlockNote, setHourBlockNote] = useState(HOUR_BLOCK_NOTE);

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
      const keys =
        payload.ruleKeys.length > 0 ? payload.ruleKeys : [...DEFAULT_ELIGIBLE];
      const fromApi = payload.eligibleRuleKeys ?? [];
      const allowed = fromApi.length > 0 ? fromApi : [...DEFAULT_ELIGIBLE];
      setEligible(allowed);
      setSelectedMovements(keys.filter((k) => allowed.includes(k)));
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

  // When job is running, mirror its ruleKeys so the UI matches the live run.
  useEffect(() => {
    if (!running || !job?.ruleKeys?.length) return;
    setSelectedMovements([...job.ruleKeys]);
  }, [running, job?.ruleKeys]);

  const toggleMovement = (key: string) => {
    setSelectedMovements((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const toggleSymbol = (symbol: string) => {
    const upper = symbol.toUpperCase();
    setSelectedSymbols((prev) =>
      prev.includes(upper) ? prev.filter((s) => s !== upper) : [...prev, upper],
    );
  };

  const saveMovements = async (keys: string[]) => {
    const payload = await putActiveMovements(keys);
    setSelectedMovements(payload.ruleKeys);
    return payload.ruleKeys;
  };

  const handleStart = async () => {
    setBusy(true);
    setError(null);
    try {
      if (selectedMovements.length === 0) {
        setError("Select at least one movement.");
        return;
      }
      if (!useAllTickers && selectedSymbols.length === 0) {
        setError("Select at least one ticker, or use all active tickers.");
        return;
      }
      const keys = await saveMovements(selectedMovements);
      const body: {
        trigger: string;
        ruleKeys: string[];
        symbols?: string[];
      } = {
        trigger: "manual",
        ruleKeys: keys,
      };
      if (!useAllTickers) body.symbols = selectedSymbols;
      const next = await startMovementWatchJob(body);
      onJobChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start Movement Watch.");
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await stopMovementWatchJob("cancelled");
      onJobChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop Movement Watch.");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveCatalogOnly = async () => {
    setBusy(true);
    setError(null);
    try {
      if (selectedMovements.length === 0) {
        setError("Select at least one movement.");
        return;
      }
      const keys = await saveMovements(selectedMovements);
      // If already running, refresh the job watchlist with the new movements.
      if (running) {
        const next = await startMovementWatchJob({
          trigger: "manual",
          ruleKeys: keys,
          ...(useAllTickers ? {} : { symbols: selectedSymbols }),
        });
        onJobChange(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save movements.");
    } finally {
      setBusy(false);
    }
  };

  const handleBlockChange = async (checked: boolean) => {
    setBlockHour(checked);
    setBusy(true);
    setError(null);
    try {
      const keys = selectedMovements.length > 0 ? selectedMovements : [...DEFAULT_ELIGIBLE];
      const payload = await putActiveMovements(keys, checked);
      setBlockHour(Boolean(payload.hourRegimeBlock));
      setHourBlockNote(payload.hourRegimeBlockNote || HOUR_BLOCK_NOTE);
      setSelectedMovements(payload.ruleKeys);
    } catch (err) {
      setBlockHour(!checked);
      setError(err instanceof Error ? err.message : "Failed to save the 1h block.");
    } finally {
      setBusy(false);
    }
  };

  const canStart =
    !busy &&
    !running &&
    !cancelledToday &&
    selectedMovements.length > 0 &&
    (useAllTickers ? activeTickers.length > 0 : selectedSymbols.length > 0);

  return (
    <section
      className="space-y-3 rounded-xl border border-ocean-mid/50 bg-ocean-deep/30 p-3"
      aria-label="Movement Watch"
    >
      <div>
        <h3 className="text-sm font-semibold text-ocean-foam">Movement Watch</h3>
        <p className="mt-0.5 text-[11px] text-ocean-sand">
          Pick movements (and optionally tickers), then Start. Default is all active
          tickers × the movements below. Keep OceanView open while running.
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
              : useAllTickers
                ? ` · ${activeTickers.length} active tickers`
                : ""}
            {cancelledToday ? " (cancelled today)" : ""}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={cn(BTN, "bg-ocean-teal text-ocean-deep")}
              disabled={!canStart}
              onClick={() => void handleStart()}
            >
              {busy && !running ? "…" : "Start"}
            </button>
            <button
              type="button"
              className={cn(BTN, "border border-ocean-mid/40 text-ocean-sand")}
              disabled={busy || !running}
              onClick={() => void handleStop()}
            >
              {busy && running ? "…" : "Stop"}
            </button>
          </div>
        </div>
        {job?.message ? (
          <p className="text-[11px] leading-snug text-ocean-sand">{job.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-ocean-foam">Active movements</p>
          <button
            type="button"
            className={cn(BTN, "border border-ocean-mid/40 text-ocean-sand")}
            disabled={busy || selectedMovements.length === 0 || !catalogLoaded}
            onClick={() => void handleSaveCatalogOnly()}
          >
            Save movements
          </button>
        </div>
        <ul className="space-y-1 rounded-md border border-ocean-mid/40 bg-ocean-surface/40 px-2 py-1.5">
          {eligible.map((key) => {
            const checked = selectedMovements.includes(key);
            return (
              <li key={key}>
                <label className="flex cursor-pointer items-start gap-1.5 text-sm text-ocean-foam hover:text-ocean-teal">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-ocean-mid accent-ocean-teal"
                    checked={checked}
                    disabled={busy}
                    onChange={() => toggleMovement(key)}
                  />
                  <span>
                    <span className="font-medium">{alarmRuleLabel(key)}</span>
                    <span className="mt-0.5 block font-mono text-[10px] text-ocean-sand/80">
                      {key}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-ocean-foam">Tickers</p>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-ocean-foam">
          <input
            type="checkbox"
            className="rounded border-ocean-mid accent-ocean-teal"
            checked={useAllTickers}
            disabled={busy || running}
            onChange={(e) => setUseAllTickers(e.target.checked)}
          />
          All active tickers ({activeTickers.length})
        </label>
        {!useAllTickers ? (
          <div
            className="max-h-36 overflow-y-auto rounded-md border border-ocean-mid/40 bg-ocean-surface/40 px-2 py-1.5"
            role="group"
            aria-label="Tickers for Movement Watch"
          >
            {tickersLoading ? (
              <p className="py-1 text-[11px] text-ocean-sand">Loading tickers…</p>
            ) : activeTickers.length === 0 ? (
              <p className="py-1 text-[11px] text-ocean-sand">No active tickers.</p>
            ) : (
              <ul className="columns-2 gap-x-3 sm:columns-3">
                {activeTickers.map((sym) => {
                  const checked = selectedSymbols.includes(sym);
                  return (
                    <li key={sym} className="break-inside-avoid py-0.5">
                      <label className="flex cursor-pointer items-center gap-1.5 text-sm text-ocean-foam hover:text-ocean-teal">
                        <input
                          type="checkbox"
                          className="rounded border-ocean-mid accent-ocean-teal"
                          checked={checked}
                          disabled={busy || running}
                          onChange={() => toggleSymbol(sym)}
                        />
                        <span className="font-semibold tabular-nums">{sym}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-xs text-ocean-danger" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
