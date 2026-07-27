import { useEffect, useMemo, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { AdminExpandedPane } from "@/features/admin/components/AdminExpandedPane";
import { patchTickersActive } from "./api/tickers-client";
import { useTickersPane } from "./hooks/useTickersPane";
import type { TradableProgressRow, TradableWatchlistRow } from "./types";

const TIER_CLASS: Record<string, string> = {
  excellent: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  strong: "bg-ocean-teal/15 text-ocean-teal-dim dark:text-ocean-teal",
  moderate: "bg-amber-500/15 text-amber-900 dark:text-amber-100",
  watch: "bg-ocean-mid/30 text-ocean-sand",
  skip: "bg-ocean-mid/30 text-ocean-sand",
};

const TIER_ORDER: Record<string, number> = {
  excellent: 0,
  strong: 1,
  moderate: 2,
  watch: 3,
  skip: 4,
};

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type SortDir = "asc" | "desc";

type ProgressSortKey =
  | "symbol"
  | "samples"
  | "ready"
  | "recent"
  | "bidAsk"
  | "move12";

type WatchlistSortKey =
  | "rank"
  | "symbol"
  | "score"
  | "tier"
  | "stockRank"
  | "callSpr"
  | "putSpr";

function fmtSpreadPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

/** True when last sample is within ~3 calendar days. */
function isRecent(lastSampleAt: string | null | undefined): boolean {
  if (!lastSampleAt) return false;
  const ts = Date.parse(lastSampleAt);
  if (Number.isNaN(ts)) return false;
  const ageMs = Date.now() - ts;
  return ageMs >= 0 && ageMs <= 3 * 24 * 60 * 60 * 1000;
}

function cmpNullableNumber(
  a: number | null | undefined,
  b: number | null | undefined,
  dir: SortDir,
): number {
  const aMissing = a == null || Number.isNaN(a);
  const bMissing = b == null || Number.isNaN(b);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return dir === "asc" ? a - b : b - a;
}

function cmpBool(a: boolean, b: boolean, dir: SortDir): number {
  if (a === b) return 0;
  const raw = a ? 1 : -1;
  return dir === "asc" ? raw : -raw;
}

function cmpString(a: string, b: string, dir: SortDir): number {
  const raw = a.localeCompare(b);
  return dir === "asc" ? raw : -raw;
}

function progressValue(row: TradableProgressRow, key: ProgressSortKey): number | string | boolean {
  switch (key) {
    case "symbol":
      return row.symbol;
    case "samples":
      return row.sampleCount;
    case "ready":
      return row.ready;
    case "recent":
      return isRecent(row.lastSampleAt);
    case "bidAsk":
      return row.typicalBidAskDollars ?? Number.NaN;
    case "move12":
      return row.underlyingMoveDollarsForOption12Pct ?? Number.NaN;
  }
}

function compareProgress(
  a: TradableProgressRow,
  b: TradableProgressRow,
  key: ProgressSortKey,
  dir: SortDir,
): number {
  if (key === "symbol") return cmpString(a.symbol, b.symbol, dir);
  if (key === "ready" || key === "recent") {
    return cmpBool(Boolean(progressValue(a, key)), Boolean(progressValue(b, key)), dir);
  }
  return cmpNullableNumber(
    progressValue(a, key) as number,
    progressValue(b, key) as number,
    dir,
  );
}

function compareWatchlist(
  a: TradableWatchlistRow,
  b: TradableWatchlistRow,
  key: WatchlistSortKey,
  dir: SortDir,
): number {
  switch (key) {
    case "symbol":
      return cmpString(a.symbol, b.symbol, dir);
    case "tier":
      return cmpNullableNumber(TIER_ORDER[a.tier] ?? 99, TIER_ORDER[b.tier] ?? 99, dir);
    case "rank":
      return cmpNullableNumber(a.rank, b.rank, dir);
    case "score":
      return cmpNullableNumber(a.score, b.score, dir);
    case "stockRank":
      return cmpNullableNumber(a.stockRank, b.stockRank, dir);
    case "callSpr":
      return cmpNullableNumber(a.call?.metrics?.medianSpreadPct, b.call?.metrics?.medianSpreadPct, dir);
    case "putSpr":
      return cmpNullableNumber(a.put?.metrics?.medianSpreadPct, b.put?.metrics?.medianSpreadPct, dir);
  }
}

function SortTh<K extends string>({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  column: K;
  sortKey: K;
  sortDir: SortDir;
  onSort: (key: K) => void;
  className?: string;
}) {
  const active = sortKey === column;
  return (
    <th className={cn("px-2 py-1.5 font-medium", className)}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 rounded px-0.5 text-left hover:text-ocean-foam",
          active ? "text-ocean-foam" : "text-ocean-sand",
        )}
        onClick={() => onSort(column)}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        <span className="tabular-nums text-[10px] opacity-80" aria-hidden>
          {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

type Props = {
  onBack: () => void;
};

export function TradablePane({ onBack }: Props) {
  const {
    tickers,
    tradable,
    tradableLoading,
    tradableRefining,
    tradableCollecting,
    tradableError,
    refineTradable,
    stopTradable,
    resettingTradable,
    resetTradableSamples,
    exportingDesk,
    downloadOceanDeskJson,
    message,
  } = useTickersPane(true);

  const progress = tradable?.progress ?? [];
  const watchlist = tradable?.watchlist ?? [];
  const batchSize = tradable?.batchSize ?? tradable?.maxSamplesPerRun ?? 5;
  const pollSeconds = tradable?.pollIntervalSeconds ?? tradable?.batchIntervalSeconds ?? 30;

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [focusedSymbol, setFocusedSymbol] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [promoteMessage, setPromoteMessage] = useState<string | null>(null);
  const [progressSortKey, setProgressSortKey] = useState<ProgressSortKey>("samples");
  const [progressSortDir, setProgressSortDir] = useState<SortDir>("desc");
  const [watchlistSortKey, setWatchlistSortKey] = useState<WatchlistSortKey>("rank");
  const [watchlistSortDir, setWatchlistSortDir] = useState<SortDir>("asc");

  const rowClass = (symbol: string) =>
    cn(
      "border-b border-ocean-mid/25 text-ocean-foam cursor-pointer transition-colors",
      "hover:bg-ocean-mid/20",
      focusedSymbol === symbol && "bg-ocean-teal/20 ring-1 ring-inset ring-ocean-teal/40",
    );

  useEffect(() => {
    if (!watchlist.length) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const row of watchlist) {
      next[row.symbol] = true;
    }
    setSelected(next);
  }, [tradable?.resolvedAt, watchlist]);

  const selectedSymbols = useMemo(
    () => Object.entries(selected).filter(([, on]) => on).map(([sym]) => sym),
    [selected],
  );

  const sortedProgress = useMemo(
    () =>
      [...progress].sort((a, b) => compareProgress(a, b, progressSortKey, progressSortDir)),
    [progress, progressSortKey, progressSortDir],
  );

  const sortedWatchlist = useMemo(
    () =>
      [...watchlist].sort((a, b) => compareWatchlist(a, b, watchlistSortKey, watchlistSortDir)),
    [watchlist, watchlistSortKey, watchlistSortDir],
  );

  const toggleProgressSort = (key: ProgressSortKey) => {
    if (key === progressSortKey) {
      setProgressSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setProgressSortKey(key);
    setProgressSortDir(key === "symbol" ? "asc" : "desc");
  };

  const toggleWatchlistSort = (key: WatchlistSortKey) => {
    if (key === watchlistSortKey) {
      setWatchlistSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setWatchlistSortKey(key);
    setWatchlistSortDir(key === "symbol" || key === "rank" || key === "tier" ? "asc" : "desc");
  };

  const canCollect = (tradable?.sourceCount ?? tickers.length) > 0;
  const collecting = tradableCollecting || tradableRefining;
  const busy = tradableLoading || collecting || promoting || exportingDesk || resettingTradable;

  const promoteSelected = async () => {
    if (selectedSymbols.length === 0) {
      setPromoteError("Select at least one ticker to promote.");
      return;
    }
    const ok = window.confirm(
      `Activate ${selectedSymbols.length} selected ticker(s) and deactivate all other catalog symbols?`,
    );
    if (!ok) return;

    setPromoteError(null);
    setPromoting(true);
    try {
      const universe = tickers.map((row) => row.symbol.toUpperCase());
      const selectedSet = new Set(selectedSymbols.map((s) => s.toUpperCase()));
      const toActivate = [...selectedSet];
      const toDeactivate = universe.filter((sym) => !selectedSet.has(sym));
      if (toActivate.length) await patchTickersActive(toActivate, true);
      if (toDeactivate.length) await patchTickersActive(toDeactivate, false);
      setPromoteMessage(
        `Promoted ${toActivate.length} ticker(s); deactivated ${toDeactivate.length} other(s).`,
      );
    } catch (err) {
      setPromoteError(err instanceof Error ? err.message : "Failed to promote selection.");
    } finally {
      setPromoting(false);
    }
  };

  return (
    <AdminExpandedPane
      id="admin-tickers-tradable"
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded border border-ocean-mid/50 px-2 py-0.5 text-xs font-medium text-ocean-sand hover:border-ocean-teal/50 hover:text-ocean-foam"
          >
            ← Tickers
          </button>
          <span>Tradable</span>
        </span>
      }
      subtitle="Option chain samples for the full catalog — Ready + Recent, best progress on top."
      headerExtra={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || !canCollect || collecting}
            onClick={() => void refineTradable()}
            className={cn(BTN, "border border-ocean-teal/50 bg-ocean-teal/15 text-ocean-foam")}
            title={canCollect ? undefined : "Add tickers under Watchlist first"}
          >
            {collecting ? `Collecting… (batch ${tradable?.batchesCompleted ?? 0})` : "Collect samples"}
          </button>
          {collecting ? (
            <button
              type="button"
              disabled={tradableLoading || promoting || exportingDesk}
              onClick={() => void stopTradable()}
              className={cn(BTN, "border border-amber-600/50 bg-amber-500/10 text-amber-900 dark:text-amber-100")}
            >
              Stop
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy || !canCollect}
            onClick={() => void downloadOceanDeskJson()}
            className={cn(
              BTN,
              "border border-ocean-mid/60 bg-ocean-deep text-ocean-foam hover:border-ocean-teal/50",
            )}
            title="Download stop_metrics.json for OceanDesk (stops + bid–ask + $→12%)"
          >
            {exportingDesk ? "…" : "Download OceanDesk JSON"}
          </button>
          <button
            type="button"
            disabled={busy || collecting}
            onClick={() => {
              const ok = window.confirm(
                "Clear all tradability samples and ticker bid–ask summaries?\n\n" +
                  "Use this after changing how bid–ask is measured. Then run Collect again.",
              );
              if (ok) void resetTradableSamples();
            }}
            className={cn(
              BTN,
              "border border-ocean-danger/50 bg-ocean-danger/10 text-ocean-danger hover:bg-ocean-danger/15",
            )}
            title="Delete stored samples so Collect rebuilds with the new ATM bid–ask zone"
          >
            {resettingTradable ? "Clearing…" : "Clear samples"}
          </button>
          <button
            type="button"
            disabled={busy || selectedSymbols.length === 0}
            onClick={() => void promoteSelected()}
            className={cn(
              BTN,
              "border-2 border-ocean-teal bg-ocean-deep text-ocean-foam hover:bg-ocean-teal/10",
            )}
          >
            {promoting ? "Promoting…" : `Promote selected (${selectedSymbols.length})`}
          </button>
        </div>
      }
    >
      <p className="mb-3 text-xs text-ocean-sand">
        Samples the <strong className="font-medium text-ocean-foam">entire catalog</strong>. Click{" "}
        <strong className="font-medium text-ocean-foam">Collect</strong> once — each ticker gets{" "}
        <strong className="font-medium text-ocean-foam">one</strong> option-chain call this run (≤
        {batchSize} every {pollSeconds}s until all are done). This pane polls on the same cadence.
        Need ≥{tradable?.minSamplesReady ?? 8} intakes over time for Ready (run Collect on later
        days to accumulate). Typical bid–ask $ uses the{" "}
        <strong className="font-medium text-ocean-foam">nearest 3 strikes</strong> to ATM on the
        front expiration. Soft{" "}
        <strong className="font-medium text-ocean-foam">WARNING</strong> can flag a day whose
        bid–ask differs from the majority (does not skip ranking). Bid–ask $ and $ move for ~12%
        option gain are saved on each ticker.{" "}
        <strong className="font-medium text-ocean-foam">Clear samples</strong> wipes old data after
        a measurement change.{" "}
        <strong className="font-medium text-ocean-foam">Download OceanDesk JSON</strong> exports
        stops (from movement profiles) plus bid–ask / $→12% — drop into OceanDesk as{" "}
        <code className="text-[11px]">stop_metrics.json</code>. Click a column header to sort;
        click a row to highlight it.
      </p>

      {tradableError ? <p className="mb-2 text-xs text-ocean-danger">{tradableError}</p> : null}
      {promoteError ? <p className="mb-2 text-xs text-ocean-danger">{promoteError}</p> : null}
      {promoteMessage ? (
        <p className="mb-2 text-xs text-ocean-teal-dim dark:text-ocean-teal">{promoteMessage}</p>
      ) : null}
      {message ? <p className="mb-2 text-xs text-ocean-teal-dim dark:text-ocean-teal">{message}</p> : null}
      {tradable?.message ? (
        <p className="mb-2 text-xs text-ocean-sand/90">{tradable.message}</p>
      ) : null}
      {tradable?.readyCount != null ? (
        <p className="mb-3 text-[11px] text-ocean-sand/70">
          Ready {tradable.readyCount}/{tradable.sourceCount || "—"} catalog
          {tradable.batchesCompleted != null && collecting
            ? ` · batches ${tradable.batchesCompleted}`
            : null}
          {tradable.collectedAt ? ` · last collect ${tradable.collectedAt}` : null}
          {collecting ? ` · polling every ${pollSeconds}s` : null}
        </p>
      ) : null}

      {!canCollect ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Catalog is empty — add symbols under Watchlist first.
        </p>
      ) : null}

      {tradableLoading && !tradable ? (
        <p className="text-xs text-ocean-sand">Loading…</p>
      ) : progress.length > 0 ? (
        <div className="mb-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-ocean-mid/40 text-[11px]">
                <SortTh
                  label="Symbol"
                  column="symbol"
                  sortKey={progressSortKey}
                  sortDir={progressSortDir}
                  onSort={toggleProgressSort}
                />
                <SortTh
                  label="Samples"
                  column="samples"
                  sortKey={progressSortKey}
                  sortDir={progressSortDir}
                  onSort={toggleProgressSort}
                />
                <SortTh
                  label="Ready"
                  column="ready"
                  sortKey={progressSortKey}
                  sortDir={progressSortDir}
                  onSort={toggleProgressSort}
                />
                <SortTh
                  label="Recent"
                  column="recent"
                  sortKey={progressSortKey}
                  sortDir={progressSortDir}
                  onSort={toggleProgressSort}
                />
                <SortTh
                  label="Bid–ask $"
                  column="bidAsk"
                  sortKey={progressSortKey}
                  sortDir={progressSortDir}
                  onSort={toggleProgressSort}
                />
                <SortTh
                  label="$ move → 12% opt"
                  column="move12"
                  sortKey={progressSortKey}
                  sortDir={progressSortDir}
                  onSort={toggleProgressSort}
                />
              </tr>
            </thead>
            <tbody>
              {sortedProgress.map((row: TradableProgressRow) => {
                const recent = isRecent(row.lastSampleAt);
                return (
                  <tr
                    key={row.symbol}
                    className={rowClass(row.symbol)}
                    onClick={() => setFocusedSymbol(row.symbol)}
                    aria-selected={focusedSymbol === row.symbol}
                  >
                    <td className="px-2 py-1.5 font-semibold">
                      {row.symbol}
                      {row.name ? (
                        <span className="ml-1 font-normal text-ocean-sand/80">{row.name}</span>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {row.sampleCount}/{row.minSamplesReady}
                    </td>
                    <td className="px-2 py-1.5">
                      {row.ready ? (
                        <span className="text-emerald-700 dark:text-emerald-300">yes</span>
                      ) : (
                        <span className="text-ocean-sand">no</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {row.lastSampleAt ? (
                        recent ? (
                          <span
                            className="text-emerald-700 dark:text-emerald-300"
                            title={row.lastSampleAt}
                          >
                            yes
                          </span>
                        ) : (
                          <span
                            className="text-amber-800 dark:text-amber-200"
                            title={row.lastSampleAt}
                          >
                            stale
                          </span>
                        )
                      ) : (
                        <span className="text-ocean-sand">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {row.typicalBidAskDollars != null ? (
                        <span
                          className={
                            row.hasSpreadDayWarning
                              ? "text-amber-800 dark:text-amber-200"
                              : undefined
                          }
                          title={
                            row.hasSpreadDayWarning
                              ? (row.warnings?.join(" · ") ??
                                "WARNING: one day's bid–ask differed from the majority over ~2 weeks (soft flag only).")
                              : undefined
                          }
                        >
                          {`$${row.typicalBidAskDollars.toFixed(2)}`}
                          {row.hasSpreadDayWarning ? (
                            <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide">
                              warn
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {row.underlyingMoveDollarsForOption12Pct != null
                        ? `$${row.underlyingMoveDollarsForOption12Pct.toFixed(2)}`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : canCollect ? (
        <p className="mb-4 text-xs text-ocean-sand">No samples yet — click Collect samples.</p>
      ) : null}

      {watchlist.length > 0 ? (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ocean-sand">
            Ranked tradable (ready only, best on top)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-ocean-mid/40 text-[11px]">
                  <th className="px-2 py-1.5 font-medium text-ocean-sand">Promote</th>
                  <SortTh
                    label="#"
                    column="rank"
                    sortKey={watchlistSortKey}
                    sortDir={watchlistSortDir}
                    onSort={toggleWatchlistSort}
                  />
                  <SortTh
                    label="Symbol"
                    column="symbol"
                    sortKey={watchlistSortKey}
                    sortDir={watchlistSortDir}
                    onSort={toggleWatchlistSort}
                  />
                  <SortTh
                    label="Tradability"
                    column="score"
                    sortKey={watchlistSortKey}
                    sortDir={watchlistSortDir}
                    onSort={toggleWatchlistSort}
                  />
                  <SortTh
                    label="Tier"
                    column="tier"
                    sortKey={watchlistSortKey}
                    sortDir={watchlistSortDir}
                    onSort={toggleWatchlistSort}
                  />
                  <SortTh
                    label="Stock #"
                    column="stockRank"
                    sortKey={watchlistSortKey}
                    sortDir={watchlistSortDir}
                    onSort={toggleWatchlistSort}
                  />
                  <SortTh
                    label="Call spr%"
                    column="callSpr"
                    sortKey={watchlistSortKey}
                    sortDir={watchlistSortDir}
                    onSort={toggleWatchlistSort}
                  />
                  <SortTh
                    label="Put spr%"
                    column="putSpr"
                    sortKey={watchlistSortKey}
                    sortDir={watchlistSortDir}
                    onSort={toggleWatchlistSort}
                  />
                </tr>
              </thead>
              <tbody>
                {sortedWatchlist.map((row: TradableWatchlistRow) => (
                  <tr
                    key={row.symbol}
                    className={rowClass(row.symbol)}
                    onClick={() => setFocusedSymbol(row.symbol)}
                    aria-selected={focusedSymbol === row.symbol}
                  >
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        className="rounded border-ocean-mid"
                        checked={Boolean(selected[row.symbol])}
                        disabled={busy}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          setSelected((prev) => ({
                            ...prev,
                            [row.symbol]: event.target.checked,
                          }))
                        }
                        aria-label={`Promote ${row.symbol}`}
                      />
                    </td>
                    <td className="px-2 py-1.5 tabular-nums text-ocean-sand">{row.rank}</td>
                    <td className="px-2 py-1.5 font-semibold">{row.symbol}</td>
                    <td className="px-2 py-1.5 tabular-nums">{row.score.toFixed(1)}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[11px] font-medium",
                          TIER_CLASS[row.tier] ?? TIER_CLASS.watch,
                        )}
                      >
                        {row.tier}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 tabular-nums text-ocean-sand">
                      {row.stockRank ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {fmtSpreadPct(row.call?.metrics?.medianSpreadPct)}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {fmtSpreadPct(row.put?.metrics?.medianSpreadPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </AdminExpandedPane>
  );
}
