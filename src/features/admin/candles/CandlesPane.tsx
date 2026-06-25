import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import { CollapsibleSection } from "@/shared/components/CollapsibleSection";
import { CandlesBanner } from "./CandlesBanner";
import { CandlesTable } from "./CandlesTable";
import { useCandlesPane } from "./hooks/useCandlesPane";

const TOOLBAR_BTN =
  "rounded px-2 py-1 text-xs font-medium disabled:opacity-50 transition-colors";

export function CandlesPane() {
  const [open, setOpen] = useState(true);
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
      subtitle="Monitor ticker price data intake"
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
