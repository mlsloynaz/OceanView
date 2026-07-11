import { cn } from "@/shared/lib/cn";
import type { CatalogSearchTicker } from "../types";

type Props = {
  query: string;
  results: CatalogSearchTicker[];
  pending: Record<string, boolean>;
  disabled?: boolean;
  catalogLoading?: boolean;
  onQueryChange: (value: string) => void;
  onToggleEnable: (symbol: string, enabled: boolean) => void;
};

export function OperationsEligibilitySearch({
  query,
  results,
  pending,
  disabled = false,
  catalogLoading = false,
  onQueryChange,
  onToggleEnable,
}: Props) {
  const trimmed = query.trim();

  return (
    <div className="space-y-3 rounded-lg border border-ocean-mid/40 bg-ocean-deep/15 px-3 py-3">
      <div>
        <label htmlFor="operations-ticker-search" className="text-xs font-medium text-ocean-foam">
          Add or remove tickers for Operations
        </label>
        <p className="mt-0.5 text-[11px] text-ocean-sand/80">
          Search the catalog, then turn Operation on or off in the results.
        </p>
      </div>

      <div className="relative max-w-md">
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ocean-sand"
          aria-hidden
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
        </span>
        <input
          id="operations-ticker-search"
          type="search"
          value={query}
          disabled={disabled || catalogLoading}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search symbol or name…"
          className="w-full rounded-md border border-ocean-mid/40 bg-ocean-surface py-1.5 pl-8 pr-3 text-sm text-ocean-foam placeholder:text-ocean-sand/60 focus:border-ocean-teal/40 focus:outline-none focus:ring-1 focus:ring-ocean-teal/20 disabled:opacity-50"
        />
      </div>

      {catalogLoading ? (
        <p className="text-xs text-ocean-sand">Loading catalog…</p>
      ) : !trimmed ? (
        <p className="text-xs text-ocean-sand/80">Type to search tickers.</p>
      ) : results.length === 0 ? (
        <p className="text-xs text-ocean-sand">No tickers match “{trimmed}”.</p>
      ) : (
        <ul className="divide-y divide-ocean-mid/30 overflow-hidden rounded-md border border-ocean-mid/40">
          {results.map((row) => {
            const rowPending = Boolean(pending[row.symbol]);
            return (
              <li
                key={row.symbol}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-ocean-surface px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ocean-foam">{row.symbol}</span>
                    {row.name ? (
                      <span className="truncate text-xs text-ocean-sand">{row.name}</span>
                    ) : null}
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                        row.isOperationEnable
                          ? "bg-ocean-teal/15 text-ocean-teal-dim dark:text-ocean-teal"
                          : "bg-ocean-mid/30 text-ocean-sand",
                      )}
                    >
                      {row.isOperationEnable ? "Ops on" : "Ops off"}
                    </span>
                    {!row.optimalRange ? (
                      <span className="text-[10px] text-ocean-sand/70">No optimal range</span>
                    ) : null}
                  </div>
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-ocean-sand">
                  <span className="sr-only">
                    {row.isOperationEnable ? "Disable" : "Enable"} operations for {row.symbol}
                  </span>
                  <input
                    type="checkbox"
                    checked={row.isOperationEnable}
                    disabled={disabled || rowPending}
                    onChange={(event) => onToggleEnable(row.symbol, event.target.checked)}
                    className="h-4 w-4 rounded border-ocean-mid/60 bg-ocean-deep accent-ocean-teal disabled:opacity-50"
                  />
                  <span aria-hidden>{rowPending ? "…" : row.isOperationEnable ? "On" : "Off"}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
