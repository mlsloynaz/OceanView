import { useEffect, useMemo, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { MarketDetailModal } from "@/features/market/components/MarketDetailModal";
import { patchTickersActive } from "./api/tickers-client";
import { orb5mHelpByColumn } from "./best-fit-orb5m-column-help";
import { BestFitOrb5mTickerDetail } from "./BestFitOrb5mTickerDetail";
import { MetricHelpTh } from "./MetricHelpIcon";
import { Orb5mMetricsHelp } from "./Orb5mMetricsHelp";
import type { BestFitOrb5mResponse, BestFitOrb5mRow, CatalogTicker } from "./types";

const COLUMN_HELP_BY_LABEL = orb5mHelpByColumn();

const TIER_CLASS: Record<string, string> = {
  excellent: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  strong: "bg-ocean-teal/15 text-ocean-teal-dim dark:text-ocean-teal",
  moderate: "bg-amber-500/15 text-amber-900 dark:text-amber-100",
  watch: "bg-ocean-mid/30 text-ocean-sand",
  skip: "bg-ocean-mid/30 text-ocean-sand",
};

function fmtPct(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function fmtUsd(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const digits = Math.abs(value) >= 0.1 ? 2 : 3;
  return `$${value.toFixed(digits)}`;
}

function sma10GapDollars(row: BestFitOrb5mRow, fallbackPrice?: number | null): number | null {
  const stored = row.metrics.sma10TurnGapDollars;
  if (stored != null && !Number.isNaN(stored)) return stored;
  const gap =
    row.metrics.mostFrequentSma10TurnGapPct ?? row.metrics.medianSma10TurnGapPct ?? null;
  const price = row.metrics.referencePrice ?? fallbackPrice ?? null;
  if (gap == null || price == null || Number.isNaN(gap) || Number.isNaN(price) || price <= 0) {
    return null;
  }
  return (price * gap) / 100;
}

type Props = {
  data: BestFitOrb5mResponse | null;
  loading: boolean;
  resolving: boolean;
  scanning: boolean;
  error: string | null;
  tickers: CatalogTicker[];
  priceBySymbol?: Record<string, number>;
  onResolve: (opts?: { forceFull?: boolean }) => Promise<void>;
  onReload: () => Promise<void>;
};

export function BestFitOrb5mSection({
  data,
  loading,
  resolving,
  scanning,
  error,
  tickers,
  priceBySymbol,
  onResolve,
  onReload,
}: Props) {
  const ranked = useMemo(() => {
    if (!data) return [] as BestFitOrb5mRow[];
    return data.ranked?.length ? data.ranked : data.watchlist;
  }, [data]);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [promoteMessage, setPromoteMessage] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpFocusId, setHelpFocusId] = useState<string | null>(null);

  const openHelp = (column?: string) => {
    setHelpFocusId(column ? COLUMN_HELP_BY_LABEL[column]?.id ?? null : null);
    setHelpOpen(true);
  };
  const [detailRow, setDetailRow] = useState<BestFitOrb5mRow | null>(null);

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
  }, [data?.resolvedAt, ranked]);

  const selectedSymbols = useMemo(
    () => Object.entries(selected).filter(([, on]) => on).map(([sym]) => sym),
    [selected],
  );

  const skipReasonSummary = useMemo(() => {
    const skipped = data?.skipped ?? [];
    if (skipped.length === 0) return [] as Array<[string, number]>;
    const counts = new Map<string, number>();
    for (const row of skipped) {
      const reason = (row.reason || "Unknown").trim() || "Unknown";
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [data?.skipped]);

  const busy = loading || resolving || scanning || promoting;
  const progress = data?.progress;
  const progressLabel =
    scanning && progress?.total
      ? `Scanning ${progress.done ?? 0}/${progress.total}…`
      : resolving
        ? "Starting…"
        : "Resolve ranking";

  const toggleOne = (symbol: string, on: boolean) => {
    setSelected((prev) => ({ ...prev, [symbol]: on }));
  };

  const selectSuggestedTop = () => {
    const keep = new Set((data?.watchlist ?? []).map((row) => row.symbol));
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
      await onReload();
    } catch (err) {
      setPromoteError(err instanceof Error ? err.message : "Failed to promote selection.");
    } finally {
      setPromoting(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => openHelp()}
          className="inline-flex items-center gap-1.5 rounded-md border border-ocean-mid/50 px-3 py-1.5 text-xs font-semibold text-ocean-sand hover:border-ocean-teal/40"
          title="What do these numbers mean?"
          aria-haspopup="dialog"
        >
          <span
            aria-hidden
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-ocean-sand/50 text-[10px] font-bold leading-none"
          >
            ?
          </span>
          Metrics help
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onResolve()}
          className="rounded-md border border-ocean-teal/50 bg-ocean-teal/15 px-3 py-1.5 text-xs font-semibold text-ocean-foam disabled:cursor-not-allowed disabled:opacity-50"
        >
          {progressLabel}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const ok = window.confirm(
              "Rebuild the full ~45-day 5m ORB history for every ticker? Daily updates stay incremental unless you do this.",
            );
            if (ok) void onResolve({ forceFull: true });
          }}
          className="rounded-md border border-ocean-mid/50 px-3 py-1.5 text-xs font-semibold text-ocean-sand hover:border-ocean-teal/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Rebuild history
        </button>
        <button
          type="button"
          disabled={busy || ranked.length === 0 || selectedSymbols.length === 0}
          onClick={() => void promoteSelected()}
          className="rounded-md border-2 border-ocean-teal bg-ocean-deep px-3 py-1.5 text-xs font-semibold text-ocean-foam hover:bg-ocean-teal/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {promoting ? "Promoting…" : `Promote selected (${selectedSymbols.length})`}
        </button>
      </div>

      <p className="mb-3 text-xs text-ocean-sand">
        We grade each stock on how it behaved after past 5-minute opening-range breakouts (last
        ~45 days). Higher score = better historical fit. Hover the <span className="font-semibold">?</span>{" "}
        on a column, or open Metrics help, for a plain-language meaning. Click a symbol for the
        full breakdown.
      </p>

      {error ? <p className="mb-2 text-xs text-ocean-danger">{error}</p> : null}
      {promoteError ? <p className="mb-2 text-xs text-ocean-danger">{promoteError}</p> : null}
      {promoteMessage ? (
        <p className="mb-2 text-xs text-ocean-teal-dim dark:text-ocean-teal">{promoteMessage}</p>
      ) : null}
      {data?.message ? <p className="mb-2 text-xs text-ocean-sand/90">{data.message}</p> : null}
      {data?.resolvedAt || scanning ? (
        <p className="mb-3 text-[11px] text-ocean-sand/70">
          {scanning ? "Scan in progress" : `Resolved ${data?.resolvedAt}`}
          {scanning
            ? ` · ${progress?.done ?? data?.scannedCount ?? 0}/${progress?.total ?? data?.universeSize ?? 0} scanned · ranking when finished`
            : data?.scoredCount != null
              ? ` · ${data.scoredCount} scored / ${data.skippedCount} skipped / universe ${data.universeSize}`
              : null}
          {data?.startDate && data?.endDate ? ` · ${data.startDate} → ${data.endDate}` : null}
        </p>
      ) : null}

      {ranked.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 max-w-sm flex-1">
            <span className="sr-only">Search ORB 5m tickers</span>
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
            Check suggested top {data?.limit ?? 10}
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

      {loading && !data ? (
        <p className="text-xs text-ocean-sand">Loading…</p>
      ) : ranked.length === 0 ? (
        <div className="space-y-2 text-xs text-amber-800 dark:text-amber-200">
          <p>
            {scanning
              ? "Collecting ticker history — the ranked table appears when all 55 finish."
              : "No scored tickers yet — resolve ranking to scan 5m ORB history."}
          </p>
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
        <p className="text-xs text-ocean-sand">No tickers match “{search.trim()}”.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-ocean-mid/40 text-[11px] text-ocean-sand">
                {(
                  [
                    "Promote",
                    "#",
                    "Symbol",
                    "Score",
                    "Tier",
                    "Follow",
                    "Earned 20",
                    "Earned 35",
                    "vs 1h",
                    "vs VWAP",
                    "Next=1h",
                    "Next+Vol",
                    "Hour",
                    "SMA10",
                    "n",
                    "Active",
                  ] as const
                ).map((label) => (
                  <MetricHelpTh
                    key={label}
                    label={label}
                    meaning={COLUMN_HELP_BY_LABEL[label]?.meaning ?? ""}
                    onOpen={() => openHelp(label)}
                  />
                ))}
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
                    <button
                      type="button"
                      onClick={() => setDetailRow(row)}
                      className="text-left text-ocean-foam underline-offset-2 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-teal"
                    >
                      {row.symbol}
                    </button>
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
                  <td className="px-2 py-1.5 tabular-nums">{fmtPct(row.metrics?.followedPct)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{fmtPct(row.metrics?.earned20Pct)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{fmtPct(row.metrics?.earned35Pct)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{fmtPct(row.metrics?.withTrendPct)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{fmtPct(row.metrics?.withVwapPct)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{fmtPct(row.metrics?.succeedNextEq1hTrendPct)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{fmtPct(row.metrics?.succeedNextWithVolPct)}</td>
                  <td className="px-2 py-1.5 tabular-nums text-ocean-sand">
                    {row.metrics?.mostProbableHourEt ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">
                    {(() => {
                      const dollars = sma10GapDollars(row, priceBySymbol?.[row.symbol]);
                      const pct =
                        row.metrics?.mostFrequentSma10TurnGapPct ??
                        row.metrics?.medianSma10TurnGapPct ??
                        row.metrics?.avgReturnToSma10Pct;
                      return (
                        <>
                          <div>{dollars != null ? fmtUsd(dollars) : fmtPct(pct, 2)}</div>
                          <div className="text-[10px] text-ocean-sand/70">
                            {dollars != null ? `${fmtPct(pct, 2)} of last close` : "of price"}
                          </div>
                        </>
                      );
                    })()}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-ocean-sand">
                    {row.metrics?.sampleSize ?? row.metrics?.eventCount ?? "—"}
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

      {data && data.skipped.length > 0 ? (
        <details className="mt-4 text-xs text-ocean-sand">
          <summary className="cursor-pointer text-ocean-foam">
            Skipped ({data.skipped.length})
          </summary>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto pl-1">
            {data.skipped.map((row) => (
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
        onClose={() => {
          setHelpOpen(false);
          setHelpFocusId(null);
        }}
        title="What these numbers mean"
        subtitle="Simple words — every metric on the table and in ticker detail"
      >
        <Orb5mMetricsHelp focusId={helpFocusId} />
        <button
          type="button"
          onClick={() => {
            setHelpOpen(false);
            setHelpFocusId(null);
          }}
          className="mt-4 rounded-md bg-ocean-teal px-3 py-1.5 text-xs font-semibold text-ocean-deep hover:brightness-105"
        >
          Got it
        </button>
      </MarketDetailModal>

      <MarketDetailModal
        open={detailRow != null}
        onClose={() => setDetailRow(null)}
        title={detailRow ? `${detailRow.symbol} — 5m ORB detail` : "Ticker detail"}
        subtitle="Historical opening-range follow-through"
      >
        {detailRow ? (
          <BestFitOrb5mTickerDetail
            row={detailRow}
            fallbackPrice={priceBySymbol?.[detailRow.symbol]}
          />
        ) : null}
        <button
          type="button"
          onClick={() => setDetailRow(null)}
          className="mt-4 rounded-md bg-ocean-teal px-3 py-1.5 text-xs font-semibold text-ocean-deep hover:brightness-105"
        >
          Close
        </button>
      </MarketDetailModal>
    </div>
  );
}
