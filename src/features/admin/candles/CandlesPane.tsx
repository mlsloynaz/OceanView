import { cn } from "@/shared/lib/cn";
import { AdminExpandedPane } from "@/features/admin/components/AdminExpandedPane";
import { candlesApiBaseUrl, candlesApiUsesMock } from "./api/candles-client";
import { CandlesBanner } from "./CandlesBanner";
import { CandlesTable } from "./CandlesTable";
import { useCandlesPane } from "./hooks/useCandlesPane";

const TOOLBAR_BTN =
  "rounded px-2 py-1 text-xs font-medium disabled:opacity-50 transition-colors";

export function CandlesPane() {
  const usesMock = candlesApiUsesMock();
  const apiBase = candlesApiBaseUrl();
  const {
    rows,
    banner,
    message,
    error,
    loading,
    bulkPending,
    profileJobPending,
    rowPending,
    refreshStatus,
    refreshAll,
    refreshOne,
    resetCandles,
    buildMovementProfiles,
    stopMovementProfiles,
  } = useCandlesPane(true);

  const busy = bulkPending || profileJobPending;

  return (
    <AdminExpandedPane
      id="admin-candles-pane"
      title="Candles"
      subtitle={
        usesMock
          ? "Mock data (VITE_USE_MOCK_CANDLES=true)"
          : `Live API${apiBase ? ` — ${apiBase}` : ""}`
      }
      className="min-w-0"
      headerExtra={
        <div className="flex flex-wrap justify-end gap-1.5">
          <button
            type="button"
            className={cn(
              TOOLBAR_BTN,
              "border border-ocean-mid/60 bg-ocean-deep text-ocean-foam hover:border-ocean-teal/50",
            )}
            disabled={busy || loading || rows.length === 0}
            onClick={refreshStatus}
          >
            {bulkPending ? "…" : "Reload Result"}
          </button>
          <button
            type="button"
            className={cn(
              TOOLBAR_BTN,
              "bg-ocean-teal font-semibold text-ocean-deep hover:brightness-105",
            )}
            disabled={busy || loading || rows.length === 0}
            title="Incremental D + 1h + 15m fetch for all active tickers"
            onClick={refreshAll}
          >
            {bulkPending ? "Refreshing…" : "Refresh candles"}
          </button>
          <button
            type="button"
            className={cn(
              TOOLBAR_BTN,
              "border border-ocean-teal/50 bg-ocean-teal/15 font-semibold text-ocean-teal-dim dark:text-ocean-teal hover:bg-ocean-teal/25",
            )}
            disabled={busy || loading || rows.length === 0}
            title="~1y hourly RTH in memory → save compact MovementProfile (batches of 5)"
            onClick={buildMovementProfiles}
          >
            {profileJobPending ? "Starting…" : "Build movement profiles"}
          </button>
          <button
            type="button"
            className={cn(
              TOOLBAR_BTN,
              "border border-ocean-mid/60 bg-ocean-deep text-ocean-foam hover:border-amber-500/50",
            )}
            disabled={loading}
            title="Stop the movement-profile maintenance job after the current batch"
            onClick={stopMovementProfiles}
          >
            Stop profiles
          </button>
          <button
            type="button"
            className={cn(
              TOOLBAR_BTN,
              "border border-ocean-danger-border bg-ocean-danger-muted text-ocean-danger hover:brightness-95",
            )}
            disabled={busy || loading || rows.length === 0}
            title="Full D + 1h + 15m re-fetch for all tickers"
            onClick={resetCandles}
          >
            Reset candles
          </button>
        </div>
      }
    >
      {!usesMock && apiBase && (
        <p className="mb-2 truncate text-[11px] text-ocean-sand/70" title={apiBase}>
          API: {apiBase}
        </p>
      )}
      {usesMock && (
        <p className="mb-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-200">
          Mock mode enabled (<code className="text-[11px]">VITE_USE_MOCK_CANDLES=true</code>).
        </p>
      )}
      <p className="mb-2 text-xs text-ocean-sand">
        Bulk actions use <strong className="font-medium text-ocean-foam">active</strong> tickers
        from Tickers ({rows.length} shown).{" "}
        <strong className="font-medium text-ocean-foam">Build movement profiles</strong> pulls ~1
        year of hourly bars in memory only (batches of 5) and stores the compact profile — not the
        bars. Track progress under Admin → Job Status.
      </p>
      {message && (
        <p className="mb-2 text-ocean-teal-dim dark:text-ocean-teal">{message}</p>
      )}
      {error && <p className="mb-2 text-ocean-danger">{error}</p>}

      <CandlesBanner banner={banner} loading={loading} />
      <CandlesTable
        rows={rows}
        loading={loading}
        bulkPending={busy}
        rowPending={rowPending}
        onRefreshOne={refreshOne}
      />
    </AdminExpandedPane>
  );
}
