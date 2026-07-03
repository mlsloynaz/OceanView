import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import { CollapsibleSection } from "@/shared/components/CollapsibleSection";
import { MarketDetailModal } from "@/features/market/components/MarketDetailModal";
import { setupScanApiBaseUrl, setupScanUsesMock } from "./api/preselection-client";
import { useSetupScanPane } from "./hooks/useSetupScanPane";
import type { PreselectionTickerRow } from "./types";

const TIER_CLASS: Record<string, string> = {
  excellent: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  strong: "bg-ocean-teal/15 text-ocean-teal-dim dark:text-ocean-teal",
  moderate: "bg-amber-500/15 text-amber-900 dark:text-amber-100",
  caution: "bg-orange-500/15 text-orange-900 dark:text-orange-100",
  skip: "bg-ocean-mid/30 text-ocean-sand",
};

function tierLabel(tier: string) {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
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

        {ticker.reasons.length > 0 && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ocean-sand">Reasons</h3>
            <ul className="list-inside list-disc space-y-1 text-ocean-foam">
              {ticker.reasons.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {ticker.avoidReasons.length > 0 && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ocean-sand">Avoid flags</h3>
            <ul className="list-inside list-disc space-y-1 text-amber-800 dark:text-amber-100">
              {ticker.avoidReasons.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {ticker.breakdown.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ocean-sand">Breakdown</h3>
            <ul className="space-y-2">
              {ticker.breakdown.map((row) => (
                <li
                  key={row.key}
                  className="rounded border border-ocean-mid/40 bg-ocean-deep/40 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-ocean-foam">{row.key}</span>
                    <span className={row.met ? "text-ocean-teal" : "text-ocean-sand"}>
                      {row.points}/{row.maxPoints}
                    </span>
                  </div>
                  <p className="mt-1 text-ocean-sand">{row.label}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </MarketDetailModal>
  );
}

export function SetupScanPane() {
  const [open, setOpen] = useState(true);
  const ws = useSetupScanPane(open);
  const usesMock = setupScanUsesMock();
  const apiBase = setupScanApiBaseUrl();

  return (
    <>
      <CollapsibleSection
        id="admin-setup-scan-pane"
        title="Setup scan"
        subtitle={
          usesMock
            ? "Mock data (VITE_USE_MOCK_SETUP_SCAN or VITE_USE_MOCK_CANDLES)"
            : "D+1h preselection — refresh stale candles, then score full catalog"
        }
        open={open}
        onOpenChange={setOpen}
        className="min-w-0"
        headerExtra={
          <div className="flex flex-wrap items-center justify-end gap-2">
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
              className="rounded border border-ocean-mid/60 bg-ocean-deep px-2 py-1 text-xs font-medium text-ocean-foam hover:border-ocean-teal/50 disabled:opacity-50"
              disabled={ws.runPending || ws.loading}
              onClick={() => ws.runScan()}
            >
              {ws.runPending ? "Scanning…" : "Run setup scan"}
            </button>
            <button
              type="button"
              className="rounded border border-ocean-mid/60 bg-ocean-deep px-2 py-1 text-xs font-medium text-ocean-foam hover:border-ocean-teal/50 disabled:opacity-50"
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
          Scans all catalog tickers (active and inactive). Refreshes candles when data is older than
          the last RTH session. Does not run during Market or Premarket evaluate — use this to pick
          which tickers to activate.
        </p>

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
            {ws.result.candles.skippedRefresh ? " (already current)" : ""}.
            {ws.result.tradeDate ? ` Trade date ${ws.result.tradeDate}.` : ""}
          </p>
        )}

        {!ws.result && !ws.loading && !ws.runPending && (
          <p className="text-sm text-ocean-sand">No setup scan result yet — run a scan to begin.</p>
        )}

        {(ws.result?.strategies ?? []).map((group) => (
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
      </CollapsibleSection>

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
