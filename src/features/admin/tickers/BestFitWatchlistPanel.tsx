import { cn } from "@/shared/lib/cn";
import type { BestFitWatchlistResponse, TradableWatchlistResponse } from "./types";

const TIER_CLASS: Record<string, string> = {
  excellent: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  strong: "bg-ocean-teal/15 text-ocean-teal-dim dark:text-ocean-teal",
  moderate: "bg-amber-500/15 text-amber-900 dark:text-amber-100",
  watch: "bg-ocean-mid/30 text-ocean-sand",
  skip: "bg-ocean-mid/30 text-ocean-sand",
};

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  result: BestFitWatchlistResponse | null;
  loading: boolean;
  resolving: boolean;
  activateTop: boolean;
  error: string | null;
  tradable: TradableWatchlistResponse | null;
  tradableLoading: boolean;
  tradableRefining: boolean;
  tradableActivateTop: boolean;
  tradableError: string | null;
  disabled?: boolean;
  onActivateTopChange: (value: boolean) => void;
  onResolve: () => void;
  onTradableActivateTopChange: (value: boolean) => void;
  onRefineTradable: () => void;
};

function fmtPct(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function fmtRate(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(0)}%`;
}

function fmtSpreadPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export function BestFitWatchlistPanel({
  result,
  loading,
  resolving,
  activateTop,
  error,
  tradable,
  tradableLoading,
  tradableRefining,
  tradableActivateTop,
  tradableError,
  disabled,
  onActivateTopChange,
  onResolve,
  onTradableActivateTopChange,
  onRefineTradable,
}: Props) {
  const busy = loading || resolving || tradableRefining || Boolean(disabled);
  const canRefine = Boolean(result?.watchlist?.length);

  return (
    <section className="mb-4 rounded-lg border border-ocean-mid/50 bg-ocean-deep/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          <h3 className="text-sm font-semibold text-ocean-foam">Watchlist selection</h3>
          <p className="mt-1 text-xs leading-relaxed text-ocean-sand">
            Step 1: long-term stock fitness from movement profiles → top 10. Step 2: collect
            tradability samples over days (≤3 Schwab calls/click) until ≥8 each → tradable top
            5. Bid–ask and “$ move for 12% option” saved on each ticker.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-ocean-sand">
            <input
              type="checkbox"
              className="rounded border-ocean-mid"
              checked={activateTop}
              disabled={busy}
              onChange={(event) => onActivateTopChange(event.target.checked)}
            />
            Activate top 10 only
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={onResolve}
            className={cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-105")}
          >
            {resolving ? "Resolving…" : "1. Resolve best-fit 10"}
          </button>
        </div>
      </div>

      {error ? <p className="mt-2 text-xs text-ocean-danger">{error}</p> : null}
      {result?.message ? (
        <p className="mt-2 text-xs text-ocean-sand/90">{result.message}</p>
      ) : null}
      {result?.resolvedAt ? (
        <p className="mt-1 text-[11px] text-ocean-sand/70">
          Best-fit {result.resolvedAt}
          {result.scoredCount != null
            ? ` · ${result.scoredCount} scored / ${result.skippedCount} skipped / universe ${result.universeSize}`
            : null}
        </p>
      ) : null}

      {result && result.watchlist.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-ocean-mid/40 text-[11px] text-ocean-sand">
                <th className="px-2 py-1.5 font-medium">#</th>
                <th className="px-2 py-1.5 font-medium">Symbol</th>
                <th className="px-2 py-1.5 font-medium">Score</th>
                <th className="px-2 py-1.5 font-medium">Tier</th>
                <th className="px-2 py-1.5 font-medium">MFE</th>
                <th className="px-2 py-1.5 font-medium">MAE</th>
                <th className="px-2 py-1.5 font-medium">Win</th>
                <th className="px-2 py-1.5 font-medium">ATR%</th>
                <th className="px-2 py-1.5 font-medium">Stop</th>
                <th className="px-2 py-1.5 font-medium">n</th>
              </tr>
            </thead>
            <tbody>
              {result.watchlist.map((row) => (
                <tr key={row.symbol} className="border-b border-ocean-mid/25 text-ocean-foam">
                  <td className="px-2 py-1.5 tabular-nums text-ocean-sand">{row.rank}</td>
                  <td className="px-2 py-1.5 font-semibold">
                    {row.symbol}
                    {row.name ? (
                      <span className="ml-1 font-normal text-ocean-sand/80">{row.name}</span>
                    ) : null}
                  </td>
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
                  <td className="px-2 py-1.5 tabular-nums">{fmtPct(row.metrics?.moveCapPct)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{fmtPct(row.metrics?.expectedMaePct)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{fmtRate(row.metrics?.winRate)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{fmtPct(row.metrics?.atrPct)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{fmtPct(row.metrics?.suggestedStopPct)}</td>
                  <td className="px-2 py-1.5 tabular-nums text-ocean-sand">
                    {row.metrics?.sampleSize ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {result && result.watchlist.length === 0 && result.resolvedAt ? (
        <p className="mt-3 text-xs text-amber-800 dark:text-amber-200">
          No eligible tickers — build movement profiles (Admin → Candles) then resolve again.
        </p>
      ) : null}

      <div className="mt-4 border-t border-ocean-mid/40 pt-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-xl">
            <h4 className="text-xs font-semibold text-ocean-foam">2. Tradable top 5</h4>
            <p className="mt-1 text-[11px] leading-relaxed text-ocean-sand">
              Collect up to 3 Schwab chain samples per click (skips symbols already sampled
              today). When a name reaches ≥8 samples, its normal bid–ask and “$ stock move for
              ~12% option gain” are saved on the ticker. Top 5 appears when enough names are
              ready.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-ocean-sand">
              <input
                type="checkbox"
                className="rounded border-ocean-mid"
                checked={tradableActivateTop}
                disabled={busy || !canRefine}
                onChange={(event) => onTradableActivateTopChange(event.target.checked)}
              />
              Activate top 5 only
            </label>
            <button
              type="button"
              disabled={busy || !canRefine}
              onClick={onRefineTradable}
              className={cn(
                BTN,
                "border-2 border-ocean-teal bg-ocean-deep text-ocean-foam hover:bg-ocean-teal/10",
              )}
              title={canRefine ? undefined : "Resolve best-fit 10 first"}
            >
              {tradableRefining ? "Sampling…" : "2. Collect tradability samples"}
            </button>
          </div>
        </div>

        {tradableError ? <p className="mt-2 text-xs text-ocean-danger">{tradableError}</p> : null}
        {tradableLoading && !tradable ? (
          <p className="mt-2 text-[11px] text-ocean-sand/70">Loading tradability progress…</p>
        ) : null}
        {tradable?.message ? (
          <p className="mt-2 text-xs text-ocean-sand/90">{tradable.message}</p>
        ) : null}
        {tradable?.readyCount != null ? (
          <p className="mt-1 text-[11px] text-ocean-sand/70">
            Ready {tradable.readyCount}/{tradable.sourceCount || "—"} (need ≥
            {tradable.minSamplesReady ?? 8} samples each)
            {tradable.collectedAt ? ` · last collect ${tradable.collectedAt}` : null}
          </p>
        ) : null}

        {tradable?.progress && tradable.progress.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-ocean-mid/40 text-[11px] text-ocean-sand">
                  <th className="px-2 py-1.5 font-medium">Symbol</th>
                  <th className="px-2 py-1.5 font-medium">Samples</th>
                  <th className="px-2 py-1.5 font-medium">Ready</th>
                  <th className="px-2 py-1.5 font-medium">Bid–ask $</th>
                  <th className="px-2 py-1.5 font-medium">Bid–ask %</th>
                  <th className="px-2 py-1.5 font-medium">$ move → 12% opt</th>
                  <th className="px-2 py-1.5 font-medium">% move → 12% opt</th>
                </tr>
              </thead>
              <tbody>
                {tradable.progress.map((row) => (
                  <tr key={row.symbol} className="border-b border-ocean-mid/25 text-ocean-foam">
                    <td className="px-2 py-1.5 font-semibold">{row.symbol}</td>
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
                    <td className="px-2 py-1.5 tabular-nums">
                      {row.typicalBidAskDollars != null
                        ? `$${row.typicalBidAskDollars.toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {fmtSpreadPct(row.typicalBidAskPct)}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {row.underlyingMoveDollarsForOption12Pct != null
                        ? `$${row.underlyingMoveDollarsForOption12Pct.toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {fmtPct(row.underlyingMovePctForOption12Pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {tradable && tradable.watchlist.length > 0 ? (
          <div className="mt-4">
            <h5 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ocean-sand">
              Tradable top 5
            </h5>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-ocean-mid/40 text-[11px] text-ocean-sand">
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
                  {tradable.watchlist.map((row) => (
                    <tr key={row.symbol} className="border-b border-ocean-mid/25 text-ocean-foam">
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

        {tradable && tradable.skipped.length > 0 ? (
          <details className="mt-3 text-xs text-ocean-sand">
            <summary className="cursor-pointer text-ocean-foam/90">
              Tradability skipped ({tradable.skipped.length})
            </summary>
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto pl-1">
              {tradable.skipped.map((row) => (
                <li key={row.symbol}>
                  <span className="font-medium text-ocean-foam">{row.symbol}</span>
                  {row.reason ? ` — ${row.reason}` : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </section>
  );
}
