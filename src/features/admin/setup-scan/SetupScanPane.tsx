import { cn } from "@/shared/lib/cn";
import { AdminExpandedPane } from "@/features/admin/components/AdminExpandedPane";
import { LiveSimulateControl } from "@/shared/components/LiveSimulateControl";
import { maxSimulationSessionDate } from "@/shared/lib/market-calendar";
import { MarketDetailModal } from "@/features/market/components/MarketDetailModal";
import { setupScanApiBaseUrl, setupScanUsesMock } from "./api/preselection-client";
import {
  helpForCriterion,
  SETUP_SCAN_TIER_HELP,
  criterionKeyFromReason,
} from "./criterion-help";
import { useSetupScanPane } from "./hooks/useSetupScanPane";
import { SemiFinalTickerSearch } from "./SemiFinalTickerSearch";
import type { PreselectionBreakdownRow, PreselectionTickerRow } from "./types";

const TIER_CLASS: Record<string, string> = {
  excellent: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  strong: "bg-ocean-teal/15 text-ocean-teal-dim dark:text-ocean-teal",
  moderate: "bg-amber-500/15 text-amber-900 dark:text-amber-100",
  caution: "bg-orange-500/15 text-orange-900 dark:text-orange-100",
  skip: "bg-ocean-mid/30 text-ocean-sand",
};

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const BTN_PRIMARY = cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-105");

const BTN_SECONDARY = cn(
  BTN,
  "border-2 border-ocean-teal bg-ocean-deep text-ocean-foam hover:bg-ocean-teal/10",
);

function tierLabel(tier: string) {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function BreakdownRow({ row }: { row: PreselectionBreakdownRow }) {
  const help = helpForCriterion(row.key);
  return (
    <li className="rounded border border-ocean-mid/40 bg-ocean-deep/40 px-3 py-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium text-ocean-foam">{help?.title ?? row.key}</span>
          {help && (
            <p className="mt-1 leading-relaxed text-ocean-sand/90">{help.description}</p>
          )}
        </div>
        <span className={cn("shrink-0 tabular-nums", row.met ? "text-ocean-teal" : "text-ocean-sand")}>
          {row.points}/{row.maxPoints}
        </span>
      </div>
      <p className="mt-2 border-t border-ocean-mid/30 pt-2 text-ocean-sand">
        <span className="font-medium text-ocean-foam/90">{row.met ? "Met:" : "Not met:"}</span>{" "}
        {row.label}
      </p>
    </li>
  );
}

function ReasonLine({ line }: { line: string }) {
  const key = criterionKeyFromReason(line);
  const help = key ? helpForCriterion(key) : null;
  return (
    <li className="leading-relaxed">
      <span className="text-ocean-foam">{line}</span>
      {help && (
        <p className="mt-0.5 text-[11px] text-ocean-sand/85">{help.description}</p>
      )}
    </li>
  );
}

function AvoidLine({ line }: { line: string }) {
  const key = criterionKeyFromReason(line);
  const help = key ? helpForCriterion(key) : null;
  return (
    <li className="leading-relaxed">
      <span className="font-medium text-amber-900 dark:text-amber-100">
        {help?.title ?? line.split(":")[0]}
      </span>
      {help ? (
        <p className="mt-0.5 text-[11px] text-amber-900/90 dark:text-amber-100/90">{help.description}</p>
      ) : null}
      <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-100/80">{line}</p>
    </li>
  );
}

function DetailModal({
  strategyName,
  ticker,
  onClose,
}: {
  strategyName: string;
  ticker: PreselectionTickerRow;
  onClose: () => void;
}) {
  return (
    <MarketDetailModal
      open
      onClose={onClose}
      title={ticker.symbol}
      subtitle={[ticker.name, strategyName].filter(Boolean).join(" · ")}
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2">
          <span className={cn("rounded px-2 py-0.5 text-xs font-medium", TIER_CLASS[ticker.tier] ?? TIER_CLASS.skip)}>
            {tierLabel(ticker.tier)} · {ticker.score}/{ticker.maxScore}
          </span>
          {ticker.directionBias && (
            <span className="rounded bg-ocean-deep px-2 py-0.5 text-xs text-ocean-foam">{ticker.directionBias}</span>
          )}
          <span className="rounded bg-ocean-deep px-2 py-0.5 text-xs text-ocean-sand">
            {ticker.currentlyActive ? "Active" : "Inactive"}
          </span>
        </div>

        <p className="rounded-lg border border-ocean-mid/35 bg-ocean-deep/25 px-3 py-2 text-[11px] leading-relaxed text-ocean-sand">
          {SETUP_SCAN_TIER_HELP}
        </p>

        {ticker.reasons.length > 0 && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ocean-sand">
              Points earned
            </h3>
            <ul className="list-none space-y-2 pl-0">
              {ticker.reasons.map((line) => (
                <ReasonLine key={line} line={line} />
              ))}
            </ul>
          </div>
        )}

        {ticker.avoidReasons.length > 0 && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ocean-sand">
              Avoid flags
            </h3>
            <ul className="list-none space-y-2 pl-0">
              {ticker.avoidReasons.map((line) => (
                <AvoidLine key={line} line={line} />
              ))}
            </ul>
          </div>
        )}

        {ticker.breakdown.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ocean-sand">
              Full checklist
            </h3>
            <ul className="space-y-2">
              {ticker.breakdown.map((row) => (
                <BreakdownRow key={row.key} row={row} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </MarketDetailModal>
  );
}

export function SetupScanPane() {
  const ws = useSetupScanPane(true);
  const usesMock = setupScanUsesMock();
  const apiBase = setupScanApiBaseUrl();

  return (
    <>
      <AdminExpandedPane
        id="admin-setup-scan-pane"
        title="Tickers SemiFinal"
        subtitle={
          usesMock
            ? "Mock data (VITE_USE_MOCK_SETUP_SCAN or VITE_USE_MOCK_CANDLES)"
            : "D+1h preselection — refresh stale candles, then score full catalog"
        }
        className="min-w-0"
        headerExtra={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <LiveSimulateControl
              mode={ws.scanMode}
              onModeChange={ws.setScanMode}
              disabled={ws.runPending || ws.loading}
              variant="compact"
              simulateInput="date"
              simulateValue={ws.simulationDate}
              onSimulateChange={ws.setSimulationDate}
              simulateInputId="setup-scan-session-date"
              simulateLabel="Session"
              simulateMax={maxSimulationSessionDate()}
              showLiveClock={false}
              ariaLabel="Tickers SemiFinal mode"
            />
            <label className="flex items-center gap-1 text-[11px] text-ocean-sand">
              Min score
              <input
                type="number"
                min={0}
                max={30}
                value={ws.minScore}
                onChange={(e) => ws.setMinScore(Number(e.target.value) || 0)}
                className="w-12 rounded border border-ocean-mid/60 bg-ocean-deep px-1 py-0.5 text-ocean-foam"
              />
            </label>
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={ws.runPending || ws.loading}
              onClick={() => ws.runScan()}
            >
              {ws.runPending ? "Scanning…" : "Run Tickers SemiFinal"}
            </button>
            <button
              type="button"
              className={BTN_SECONDARY}
              disabled={ws.loading || ws.runPending}
              onClick={() => void ws.loadResult()}
            >
              {ws.loading ? "…" : "Reload result"}
            </button>
          </div>
        }
      >
        {!usesMock && apiBase && (
          <p className="mb-2 truncate text-[11px] text-ocean-sand/70" title={apiBase}>
            API: {apiBase}
          </p>
        )}

        <p className="mb-3 text-xs text-ocean-sand">
          Scans all catalog tickers (active and inactive). Live mode refreshes stale candles through
          the last completed session. Simulate mode scores post-market of a chosen session day using
          stored bars only — no candle refresh.
        </p>

        {ws.scanMode === "simulate" && (
          <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
            Simulation uses session close (4:00 PM ET, or 1:00 PM on early-close days). Pick a
            NYSE market day — weekends and holidays are rejected. On weekends, the default is the
            last session (e.g. {maxSimulationSessionDate()}).
          </p>
        )}

        {ws.result?.simulated && (
          <p className="mb-3 rounded-lg border border-ocean-teal/40 bg-ocean-teal/10 px-3 py-2 text-xs text-ocean-foam">
            Simulated post-market scan for {ws.result.simulationDate ?? ws.result.tradeDate}
            {ws.result.simulationTimeEt ? ` · anchor ${ws.result.simulationTimeEt}` : ""}.
          </p>
        )}

        {ws.message && (
          <p className="mb-2 text-sm text-ocean-teal-dim dark:text-ocean-teal" role="status">
            {ws.message}
          </p>
        )}
        {ws.error && (
          <p className="mb-2 text-sm text-ocean-danger" role="alert">
            {ws.error}
          </p>
        )}

        {ws.result?.candles && (
          <p className="mb-3 rounded-lg border border-ocean-mid/40 bg-ocean-deep/30 px-3 py-2 text-xs text-ocean-sand">
            Candles: {ws.result.candles.symbolsRefreshed ?? 0} refreshed of{" "}
            {ws.result.candles.symbolsStale ?? 0} stale / {ws.result.candles.symbolsTotal ?? 0} total
            {ws.result.candles.skippedRefresh ? " (refresh skipped)" : ""}.
            {ws.result.tradeDate ? ` Trade date ${ws.result.tradeDate}.` : ""}
          </p>
        )}

        {ws.result && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SemiFinalTickerSearch
              value={ws.search}
              suggestions={ws.searchSuggestions}
              disabled={ws.loading || ws.runPending}
              onChange={ws.setSearch}
              onSelect={ws.selectSearchTicker}
            />
            {ws.search.trim() ? (
              <button
                type="button"
                disabled={ws.loading || ws.runPending}
                onClick={() => ws.setSearch("")}
                className="rounded px-2 py-1 text-xs font-medium text-ocean-sand hover:text-ocean-foam"
              >
                Clear
              </button>
            ) : null}
            {ws.search.trim() ? (
              <span className="text-[11px] text-ocean-sand/80">
                {ws.searchMatchCount} match{ws.searchMatchCount === 1 ? "" : "es"}
              </span>
            ) : null}
          </div>
        )}

        {!ws.result && !ws.loading && !ws.runPending && (
          <p className="text-sm text-ocean-sand">No Tickers SemiFinal result yet — run a scan to begin.</p>
        )}

        {ws.result && ws.search.trim() && (ws.filteredResult?.strategies.length ?? 0) === 0 && (
          <p className="mb-3 text-sm text-ocean-sand">
            No tickers match “{ws.search.trim()}”.
          </p>
        )}

        {(ws.filteredResult?.strategies ?? []).map((group) => (
          <section key={group.strategyId} className="mb-6 last:mb-0">
            <h3 className="mb-2 font-display text-lg text-ocean-foam">
              {group.shortName || group.name}
              <span className="ml-2 text-sm font-normal text-ocean-sand">({group.tickerCount})</span>
            </h3>
            {group.tickers.length === 0 ? (
              <p className="text-sm text-ocean-sand">No tickers at or above min score.</p>
            ) : (
              <ul className="space-y-2">
                {group.tickers.map((ticker) => {
                  const pending = Boolean(ws.tickerPending[ticker.symbol]);
                  return (
                    <li
                      key={`${group.strategyId}-${ticker.symbol}`}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-3 py-2"
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() =>
                          ws.setDetail({ strategyName: group.shortName || group.name, ticker })
                        }
                      >
                        <span className="font-medium text-ocean-foam">{ticker.symbol}</span>
                        {ticker.name && (
                          <span className="ml-2 text-xs text-ocean-sand">{ticker.name}</span>
                        )}
                        <span
                          className={cn(
                            "ml-2 inline rounded px-1.5 py-0.5 text-[10px] font-medium",
                            TIER_CLASS[ticker.tier] ?? TIER_CLASS.skip,
                          )}
                        >
                          {ticker.score} · {tierLabel(ticker.tier)}
                        </span>
                        {ticker.directionBias && (
                          <span className="ml-1 text-[10px] text-ocean-teal">{ticker.directionBias}</span>
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        className="rounded border border-ocean-mid/60 px-2 py-1 text-xs text-ocean-foam hover:border-ocean-teal/50 disabled:opacity-50"
                        onClick={() => void ws.setActive(ticker.symbol, !ticker.currentlyActive)}
                      >
                        {pending ? "…" : ticker.currentlyActive ? "Deactivate" : "Activate"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </AdminExpandedPane>

      {ws.detail && (
        <DetailModal
          strategyName={ws.detail.strategyName}
          ticker={ws.detail.ticker}
          onClose={() => ws.setDetail(null)}
        />
      )}
    </>
  );
}
