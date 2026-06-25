import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import { CollapsibleSection } from "@/shared/components/CollapsibleSection";
import { candlesApiBaseUrl, candlesApiUsesMock } from "./api/candles-client";
import { CandlesBanner } from "./CandlesBanner";
import { CandlesTable } from "./CandlesTable";
import { useCandlesPane } from "./hooks/useCandlesPane";

const TOOLBAR_BTN =
  "rounded px-2 py-1 text-xs font-medium disabled:opacity-50 transition-colors";

export function CandlesPane() {
  const [open, setOpen] = useState(true);
  const usesMock = candlesApiUsesMock();
  const apiBase = candlesApiBaseUrl();
  const {
    rows,
    banner,
    message,
    error,
    loading,
    bulkPending,
    rowPending,
    refreshStatus,
    refreshAll,
    refreshOne,
    resetCandles,
  } = useCandlesPane(open);

  return (
    <CollapsibleSection
      id="admin-candles-pane"
      title="Candles"
      subtitle={
        usesMock
          ? "Mock data (VITE_USE_MOCK_CANDLES=true)"
          : `Live API${apiBase ? ` — ${apiBase}` : ""}`
      }
      open={open}
      onOpenChange={setOpen}
      className="min-w-0"
      headerExtra={
        <div className="flex flex-wrap justify-end gap-1.5">
          <button
            type="button"
            className={cn(
              TOOLBAR_BTN,
              "border border-ocean-mid/60 bg-ocean-deep text-ocean-foam hover:border-ocean-teal/50",
            )}
            disabled={bulkPending || loading || rows.length === 0}
            onClick={refreshStatus}
          >
            {bulkPending ? "…" : "Refresh status"}
          </button>
          <button
            type="button"
            className={cn(
              TOOLBAR_BTN,
              "bg-ocean-teal font-semibold text-ocean-deep hover:brightness-105",
            )}
            disabled={bulkPending || loading || rows.length === 0}
            onClick={refreshAll}
          >
            {bulkPending ? "Refreshing…" : "Refresh candles"}
          </button>
          <button
            type="button"
            className={cn(
              TOOLBAR_BTN,
              "border border-ocean-danger-border bg-ocean-danger-muted text-ocean-danger hover:brightness-95",
            )}
            disabled={bulkPending || loading || rows.length === 0}
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
      {message && (
        <p className="mb-2 text-ocean-teal-dim dark:text-ocean-teal">{message}</p>
      )}
      {error && <p className="mb-2 text-ocean-danger">{error}</p>}

      <CandlesBanner banner={banner} loading={loading} />
      <CandlesTable
        rows={rows}
        loading={loading}
        bulkPending={bulkPending}
        rowPending={rowPending}
        onRefreshOne={refreshOne}
      />
    </CollapsibleSection>
  );
}
