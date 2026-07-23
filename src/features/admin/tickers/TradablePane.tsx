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

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

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

type Props = {
  onBack: () => void;
};

export function TradablePane({ onBack }: Props) {
  const {
    tickers,
    tradable,
    tradableLoading,
    tradableRefining,
    tradableError,
    refineTradable,
    message,
  } = useTickersPane(true);

  const progress = tradable?.progress ?? [];
  const watchlist = tradable?.watchlist ?? [];

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [promoteMessage, setPromoteMessage] = useState<string | null>(null);
  const [forceResample, setForceResample] = useState(false);

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

  const canCollect = (tradable?.sourceCount ?? tickers.length) > 0;
  const busy = tradableLoading || tradableRefining || promoting;

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
          <label className="flex items-center gap-1.5 text-[11px] text-ocean-sand">
            <input
              type="checkbox"
              className="rounded border-ocean-mid"
              checked={forceResample}
              disabled={busy}
              onChange={(event) => setForceResample(event.target.checked)}
            />
            Force (ignore {tradable?.minResampleGapMinutes ?? 15}m gap)
          </label>
          <button
            type="button"
            disabled={busy || !canCollect}
            onClick={() => void refineTradable({ force: forceResample })}
            className={cn(BTN, "border border-ocean-teal/50 bg-ocean-teal/15 text-ocean-foam")}
            title={canCollect ? undefined : "Add tickers under Watchlist first"}
          >
            {tradableRefining ? "Sampling…" : "Collect samples"}
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
        Samples the <strong className="font-medium text-ocean-foam">entire catalog</strong>. Each
        Collect adds up to 3 intakes (symbols furthest from Ready first). You need ≥
        {tradable?.minSamplesReady ?? 8} intakes per symbol for a stable typical bid–ask — click
        again after ~{tradable?.minResampleGapMinutes ?? 15} minutes (or enable Force) to add more
        the same day. Bid–ask $ and $ move for ~12% option gain are saved on each ticker.
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
          {tradable.collectedAt ? ` · last collect ${tradable.collectedAt}` : null}
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
              <tr className="border-b border-ocean-mid/40 text-[11px] text-ocean-sand">
                <th className="px-2 py-1.5 font-medium">Symbol</th>
                <th className="px-2 py-1.5 font-medium">Samples</th>
                <th className="px-2 py-1.5 font-medium">Ready</th>
                <th className="px-2 py-1.5 font-medium">Recent</th>
                <th className="px-2 py-1.5 font-medium">Bid–ask $</th>
                <th className="px-2 py-1.5 font-medium">$ move → 12% opt</th>
              </tr>
            </thead>
            <tbody>
              {progress.map((row: TradableProgressRow) => {
                const recent = isRecent(row.lastSampleAt);
                return (
                  <tr key={row.symbol} className="border-b border-ocean-mid/25 text-ocean-foam">
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
                      {row.typicalBidAskDollars != null
                        ? `$${row.typicalBidAskDollars.toFixed(2)}`
                        : "—"}
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
                <tr className="border-b border-ocean-mid/40 text-[11px] text-ocean-sand">
                  <th className="px-2 py-1.5 font-medium">Promote</th>
                  <th className="px-2 py-1.5 font-medium">#</th>
                  <th className="px-2 py-1.5 font-medium">Symbol</th>
                  <th className="px-2 py-1.5 font-medium">Tradability</th>
                  <th className="px-2 py-1.5 font-medium">Tier</th>
                  <th className="px-2 py-1.5 font-medium">Stock #</th>
                  <th className="px-2 py-1.5 font-medium">Call spr%</th>
                  <th className="px-2 py-1.5 font-medium">Put spr%</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map((row: TradableWatchlistRow) => (
                  <tr key={row.symbol} className="border-b border-ocean-mid/25 text-ocean-foam">
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        className="rounded border-ocean-mid"
                        checked={Boolean(selected[row.symbol])}
                        disabled={busy}
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
