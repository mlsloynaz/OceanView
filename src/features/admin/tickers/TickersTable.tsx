import { useEffect, useRef } from "react";
import { cn } from "@/shared/lib/cn";
import type { CatalogTicker, TickerMovementProfileEntry } from "./types";
import { TickerMovementInfoPanel } from "./TickerMovementInfoPanel";

type PageActiveState = "all" | "none" | "mixed";

type ProfileCacheEntry =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; entry: TickerMovementProfileEntry };

type Props = {
  rows: CatalogTicker[];
  loading: boolean;
  pending: Record<string, boolean>;
  bulkPending: boolean;
  pageActiveState: PageActiveState;
  emptyMessage?: string;
  expandedSymbol: string | null;
  profileCache: Record<string, ProfileCacheEntry>;
  onToggleExpanded: (symbol: string) => void;
  onToggleActive: (symbol: string, active: boolean) => void;
  onPageActiveChange: (active: boolean) => void;
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-3.5 w-3.5 shrink-0 text-ocean-sand transition-transform", open && "rotate-180")}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function TickersTable({
  rows,
  loading,
  pending,
  bulkPending,
  pageActiveState,
  emptyMessage,
  expandedSymbol,
  profileCache,
  onToggleExpanded,
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
          Symbol · click for movement info
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
          const expanded = expandedSymbol === symbolUpper;
          const cache = profileCache[symbolUpper];

          return (
            <li
              key={row.symbol}
              className={cn("bg-ocean-surface", !row.active && "opacity-70")}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-2 py-2">
                <button
                  type="button"
                  onClick={() => onToggleExpanded(row.symbol)}
                  aria-expanded={expanded}
                  title={expanded ? "Hide movement info" : "Show how this ticker usually moves"}
                  className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-left hover:brightness-110"
                >
                  <Chevron open={expanded} />
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
                </button>

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
              </div>

              {expanded && (
                <TickerMovementInfoPanel
                  loading={cache?.status === "loading" || !cache}
                  error={cache?.status === "error" ? cache.error : null}
                  profile={cache?.status === "ready" ? cache.entry.profile : null}
                  updatedAt={cache?.status === "ready" ? cache.entry.updatedAt : null}
                  historyBars={cache?.status === "ready" ? cache.entry.historyBars : null}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
