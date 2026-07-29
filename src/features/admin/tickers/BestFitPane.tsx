import { useEffect, useMemo, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { AdminExpandedPane } from "@/features/admin/components/AdminExpandedPane";
import { MarketDetailModal } from "@/features/market/components/MarketDetailModal";
import { patchTickersActive } from "./api/tickers-client";
import { BEST_FIT_COLUMN_HELP } from "./best-fit-column-help";
import { useTickersPane } from "./hooks/useTickersPane";
import type { BestFitWatchlistRow } from "./types";

const TIER_CLASS: Record<string, string> = {
  excellent: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  strong: "bg-ocean-teal/15 text-ocean-teal-dim dark:text-ocean-teal",
  moderate: "bg-amber-500/15 text-amber-900 dark:text-amber-100",
  watch: "bg-ocean-mid/30 text-ocean-sand",
  skip: "bg-ocean-mid/30 text-ocean-sand",
};

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

function fmtPct(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function fmtRate(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(0)}%`;
}

type Props = {
  onBack: () => void;
};

export function BestFitPane({ onBack }: Props) {
  const {
    bestFit,
    bestFitLoading,
    bestFitResolving,
    bestFitError,
    resolveBestFit,
    reload,
    message,
    tickers,
  } = useTickersPane(true);

  const ranked = useMemo(() => {
    if (!bestFit) return [] as BestFitWatchlistRow[];
    const rows = bestFit.ranked?.length ? bestFit.ranked : bestFit.watchlist;
    return rows;
  }, [bestFit]);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [promoteMessage, setPromoteMessage] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const filteredRanked = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ranked;
    return ranked.filter(
      (row) =>
        row.symbol.toLowerCase().includes(q) ||
        (row.name?.toLowerCase().includes(q) ?? false),
    );
  }, [ranked, search]);

  useEffect(() => {
    if (!ranked.length) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const row of ranked) {
      next[row.symbol] = Boolean(row.currentlyActive);
    }
    setSelected(next);
  }, [bestFit?.resolvedAt, ranked]);

  const selectedSymbols = useMemo(
    () => Object.entries(selected).filter(([, on]) => on).map(([sym]) => sym),
    [selected],
  );

  const skipReasonSummary = useMemo(() => {
    const skipped = bestFit?.skipped ?? [];
    if (skipped.length === 0) return [] as Array<[string, number]>;
    const counts = new Map<string, number>();
    for (const row of skipped) {
      const reason = (row.reason || "Unknown").trim() || "Unknown";
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [bestFit?.skipped]);

  const busy = bestFitLoading || bestFitResolving || promoting;

  const toggleOne = (symbol: string, on: boolean) => {
    setSelected((prev) => ({ ...prev, [symbol]: on }));
  };

  const selectSuggestedTop = () => {
    const keep = new Set((bestFit?.watchlist ?? []).map((row) => row.symbol));
    const next: Record<string, boolean> = {};
    for (const row of ranked) {
      next[row.symbol] = keep.has(row.symbol);
    }
    setSelected(next);
  };

  const clearSelection = () => {
    const next: Record<string, boolean> = {};
    for (const row of ranked) next[row.symbol] = false;
    setSelected(next);
  };

  const promoteSelected = async () => {
    if (selectedSymbols.length === 0) {
      setPromoteError("Select at least one ticker to promote.");
      return;
    }
    const ok = window.confirm(
      `Activate ${selectedSymbols.length} selected ticker(s) and deactivate all others in the catalog?`,
    );
    if (!ok) return;

    setPromoteError(null);
    setPromoting(true);
    try {
      const allSymbols = tickers.map((row) => row.symbol.toUpperCase());
      const selectedSet = new Set(selectedSymbols.map((s) => s.toUpperCase()));
      const toActivate = [...selectedSet];
      const toDeactivate = allSymbols.filter((sym) => !selectedSet.has(sym));

      if (toActivate.length) await patchTickersActive(toActivate, true);
      if (toDeactivate.length) await patchTickersActive(toDeactivate, false);

      setSelected((prev) => {
        const next: Record<string, boolean> = {};
        for (const sym of Object.keys(prev)) next[sym] = selectedSet.has(sym);
        return next;
      });
      setPromoteMessage(
        `Promoted ${toActivate.length} ticker(s); deactivated ${toDeactivate.length} other(s).`,
      );
      await reload();
      await resolveBestFit();
    } catch (err) {
      setPromoteError(err instanceof Error ? err.message : "Failed to promote selection.");
    } finally {
      setPromoting(false);
    }
  };

  return (
    <AdminExpandedPane
      id="admin-tickers-best-fit"
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded border border-ocean-mid/50 px-2 py-0.5 text-xs font-medium text-ocean-sand hover:border-ocean-teal/50 hover:text-ocean-foam"
          >
            ← Tickers
          </button>
          <span>Best-fit</span>
        </span>
      }
      subtitle="All scored tickers from movement profiles — best on top. Check boxes to promote."
      headerExtra={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className={cn(BTN, "border border-ocean-mid/50 text-ocean-sand hover:border-ocean-teal/40")}
            title="What do these columns mean?"
            aria-haspopup="dialog"
          >
            Column help
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void resolveBestFit()}
            className={cn(BTN, "border border-ocean-teal/50 bg-ocean-teal/15 text-ocean-foam")}
          >
            {bestFitResolving ? "Resolving…" : "Resolve ranking"}
          </button>
          <button
            type="button"
            disabled={busy || ranked.length === 0 || selectedSymbols.length === 0}
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
        Ranking uses stored movement profiles (Candles → Build movement profiles). Display is
        always sorted by score. Promotion is only what you check — not automatic top N.
      </p>

      {bestFitError ? <p className="mb-2 text-xs text-ocean-danger">{bestFitError}</p> : null}
      {promoteError ? <p className="mb-2 text-xs text-ocean-danger">{promoteError}</p> : null}
      {promoteMessage ? (
        <p className="mb-2 text-xs text-ocean-teal-dim dark:text-ocean-teal">{promoteMessage}</p>
      ) : null}
      {message ? <p className="mb-2 text-xs text-ocean-teal-dim dark:text-ocean-teal">{message}</p> : null}
      {bestFit?.message ? (
        <p className="mb-2 text-xs text-ocean-sand/90">{bestFit.message}</p>
      ) : null}
      {bestFit?.resolvedAt ? (
        <p className="mb-3 text-[11px] text-ocean-sand/70">
          Resolved {bestFit.resolvedAt}
          {bestFit.scoredCount != null
            ? ` · ${bestFit.scoredCount} scored / ${bestFit.skippedCount} skipped / universe ${bestFit.universeSize}`
            : null}
        </p>
      ) : null}

      {ranked.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 max-w-sm flex-1">
            <span className="sr-only">Search best-fit tickers</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search symbol or name…"
              disabled={busy}
              className="w-full rounded-md border border-ocean-mid/40 bg-ocean-surface px-3 py-1.5 text-sm text-ocean-foam placeholder:text-ocean-sand/60 focus:border-ocean-teal/50 focus:outline-none"
            />
          </label>
          {search.trim() ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setSearch("")}
              className="rounded border border-ocean-mid/50 px-2 py-1 text-[11px] text-ocean-sand hover:border-ocean-teal/40"
            >
              Clear search
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={selectSuggestedTop}
            className="rounded border border-ocean-mid/50 px-2 py-1 text-[11px] text-ocean-sand hover:border-ocean-teal/40"
          >
            Check suggested top {bestFit?.limit ?? 10}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={clearSelection}
            className="rounded border border-ocean-mid/50 px-2 py-1 text-[11px] text-ocean-sand hover:border-ocean-teal/40"
          >
            Clear checks
          </button>
          {search.trim() ? (
            <span className="text-[11px] text-ocean-sand">
              Showing {filteredRanked.length} of {ranked.length}
            </span>
          ) : null}
        </div>
      ) : null}

      {bestFitLoading && !bestFit ? (
        <p className="text-xs text-ocean-sand">Loading…</p>
      ) : ranked.length === 0 ? (
        <div className="space-y-2 text-xs text-amber-800 dark:text-amber-200">
          <p>No scored tickers yet — resolve ranking after building movement profiles.</p>
          {skipReasonSummary.length > 0 ? (
            <ul className="list-disc space-y-0.5 pl-4 text-ocean-sand">
              {skipReasonSummary.map(([reason, count]) => (
                <li key={reason}>
                  <span className="tabular-nums text-ocean-foam">{count}</span> — {reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : filteredRanked.length === 0 ? (
        <p className="text-xs text-ocean-sand">
          No tickers match “{search.trim()}”.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-ocean-mid/40 text-[11px] text-ocean-sand">
                <th className="px-2 py-1.5 font-medium">Promote</th>
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
                <th className="px-2 py-1.5 font-medium">Active</th>
              </tr>
            </thead>
            <tbody>
              {filteredRanked.map((row) => (
                <tr
                  key={row.symbol}
                  className="border-b border-ocean-mid/25 text-ocean-foam transition-colors hover:bg-ocean-teal/15"
                >
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      className="rounded border-ocean-mid"
                      checked={Boolean(selected[row.symbol])}
                      disabled={busy}
                      onChange={(event) => toggleOne(row.symbol, event.target.checked)}
                      aria-label={`Promote ${row.symbol}`}
                    />
                  </td>
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
                  <td className="px-2 py-1.5 text-ocean-sand">
                    {row.currentlyActive ? "yes" : "no"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bestFit && bestFit.skipped.length > 0 ? (
        <details className="mt-4 text-xs text-ocean-sand">
          <summary className="cursor-pointer text-ocean-foam">
            Skipped ({bestFit.skipped.length})
          </summary>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto pl-1">
            {bestFit.skipped.map((row) => (
              <li key={row.symbol}>
                <span className="font-medium text-ocean-foam">{row.symbol}</span>
                {row.reason ? ` — ${row.reason}` : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <MarketDetailModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Best-fit columns"
        subtitle="Simple meanings — no jargon required"
      >
        <ul className="space-y-3 text-sm text-ocean-foam">
          {BEST_FIT_COLUMN_HELP.map((item) => (
            <li key={item.column} className="border-b border-ocean-mid/25 pb-3 last:border-0 last:pb-0">
              <p className="font-semibold text-ocean-teal-dim dark:text-ocean-teal">{item.column}</p>
              <p className="mt-0.5 text-ocean-sand">{item.meaning}</p>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setHelpOpen(false)}
          className="mt-4 rounded-md bg-ocean-teal px-3 py-1.5 text-xs font-semibold text-ocean-deep hover:brightness-105"
        >
          Got it
        </button>
      </MarketDetailModal>
    </AdminExpandedPane>
  );
}
