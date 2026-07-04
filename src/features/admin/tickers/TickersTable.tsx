import { useEffect, useRef } from "react";
import { cn } from "@/shared/lib/cn";
import type { CatalogTicker } from "./types";

type PageActiveState = "all" | "none" | "mixed";

type Props = {
  rows: CatalogTicker[];
  loading: boolean;
  pending: Record<string, boolean>;
  bulkPending: boolean;
  pageActiveState: PageActiveState;
  emptyMessage?: string;
  onToggleActive: (symbol: string, active: boolean) => void;
  onPageActiveChange: (active: boolean) => void;
};

export function TickersTable({
  rows,
  loading,
  pending,
  bulkPending,
  pageActiveState,
  emptyMessage,
  onToggleActive,
  onPageActiveChange,
}: Props) {
  const pageCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pageCheckboxRef.current) {
      pageCheckboxRef.current.indeterminate = pageActiveState === "mixed";
    }
  }, [pageActiveState]);

  if (loading) {
    return null;
  }

  if (rows.length === 0) {
    return (
      <p className="leading-snug text-ocean-sand">
        {emptyMessage ??
          "No tickers match this filter. Sync symbols via OceanView-API seed script if the catalog is empty."}
      </p>
    );
  }

  const pageToggleDisabled = bulkPending;

  return (
    <div className="overflow-hidden rounded-lg border border-ocean-mid/40">
      <div className="flex items-center justify-between gap-3 border-b border-ocean-mid/40 bg-ocean-deep/25 px-2 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ocean-sand">
          Symbol
        </span>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-ocean-sand">
          <span className="hidden sm:inline">Active</span>
          <span className="sr-only">Toggle all tickers on this page</span>
          <input
            ref={pageCheckboxRef}
            type="checkbox"
            checked={pageActiveState === "all"}
            disabled={pageToggleDisabled}
            onChange={(event) => onPageActiveChange(event.target.checked)}
            className="h-4 w-4 rounded border-ocean-mid/60 bg-ocean-deep accent-ocean-teal disabled:opacity-50"
          />
        </label>
      </div>

      <ul className="divide-y divide-ocean-mid/30">
        {rows.map((row) => {
          const symbolUpper = row.symbol.toUpperCase();
          const rowPending = bulkPending || Boolean(pending[symbolUpper]);

          return (
            <li
              key={row.symbol}
              className={cn(
                "flex flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-ocean-surface px-2 py-2",
                !row.active && "opacity-70",
              )}
            >
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                {row.isFavorite && (
                  <span className="text-xs text-ocean-teal" title="Favorite">
                    ★
                  </span>
                )}
                <span className="text-sm font-semibold text-ocean-foam">{row.symbol}</span>
                {row.name && <span className="text-xs text-ocean-sand">{row.name}</span>}
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    row.active
                      ? "bg-ocean-teal/15 text-ocean-teal-dim dark:text-ocean-teal"
                      : "bg-ocean-mid/30 text-ocean-sand",
                  )}
                >
                  {row.active ? "Active" : "Inactive"}
                </span>
              </div>

              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-ocean-sand">
                <span className="sr-only">Active for Market and Candles</span>
                <input
                  type="checkbox"
                  checked={row.active}
                  disabled={rowPending}
                  onChange={(event) => onToggleActive(row.symbol, event.target.checked)}
                  className="h-4 w-4 rounded border-ocean-mid/60 bg-ocean-deep accent-ocean-teal disabled:opacity-50"
                />
                <span className="hidden sm:inline" aria-hidden>
                  {rowPending ? "…" : row.active ? "On" : "Off"}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
