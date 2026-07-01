import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import { CollapsibleSection } from "@/shared/components/CollapsibleSection";
import { tickersApiBaseUrl, tickersApiUsesMock } from "./api/tickers-client";
import { useTickersPane } from "./hooks/useTickersPane";
import { TickersPager } from "./TickersPager";
import { TickersTable } from "./TickersTable";
import { TickerCatalogSearch } from "./TickerCatalogSearch";
import type { TickerCatalogFilter } from "./types";

const FILTER_BTN =
  "rounded px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-50";

export function TickersPane() {
  const [open, setOpen] = useState(true);
  const usesMock = tickersApiUsesMock();
  const apiBase = tickersApiBaseUrl();
  const {
    pageTickers,
    page,
    pages,
    pageSize,
    filteredCount,
    search,
    searchSuggestions,
    setSearch,
    selectSearchTicker,
    setPage,
    filter,
    setFilter,
    counts,
    pageCounts,
    loading,
    error,
    message,
    pending,
    isPending,
    reload,
    activatePage,
    deactivatePage,
    setActive,
  } = useTickersPane(open);

  const filters: { id: TickerCatalogFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.total },
    { id: "active", label: "Active", count: counts.active },
    { id: "inactive", label: "Inactive", count: counts.inactive },
  ];

  return (
    <CollapsibleSection
      id="admin-tickers-pane"
      title="Ticker catalog"
      subtitle={
        usesMock
          ? "Mock data (VITE_USE_MOCK_CANDLES=true)"
          : `Live API${apiBase ? ` — ${apiBase}` : ""}`
      }
      open={open}
      onOpenChange={setOpen}
      className="min-w-0"
      headerExtra={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-[11px] text-ocean-sand/80">
            {counts.active} active · {counts.total} total · A–Z
          </span>
          <button
            type="button"
            className="rounded border border-ocean-mid/60 bg-ocean-deep px-2 py-1 text-xs font-medium text-ocean-foam hover:border-ocean-teal/50 disabled:opacity-50"
            disabled={loading || isPending}
            onClick={() => void reload()}
          >
            {loading ? "…" : "Reload"}
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
          Mock mode — toggles update in-memory catalog only.
        </p>
      )}

      <p className="mb-3 text-xs text-ocean-sand">
        Tickers are sorted A–Z, {pageSize} per page. Page actions apply to the current page only.
        Active tickers are included in Market Assess and Candles bulk refresh.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TickerCatalogSearch
          value={search}
          suggestions={searchSuggestions}
          disabled={loading || isPending}
          onChange={setSearch}
          onSelect={selectSearchTicker}
        />
        {search.trim() ? (
          <button
            type="button"
            disabled={loading || isPending}
            onClick={() => setSearch("")}
            className="rounded px-2 py-1 text-xs font-medium text-ocean-sand hover:text-ocean-foam"
          >
            Clear
          </button>
        ) : null}
        {search.trim() ? (
          <span className="text-[11px] text-ocean-sand/80">
            {filteredCount} match{filteredCount === 1 ? "" : "es"}
          </span>
        ) : null}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={loading || isPending}
            onClick={() => setFilter(item.id)}
            className={cn(
              FILTER_BTN,
              filter === item.id
                ? "bg-ocean-teal/20 text-ocean-teal-dim dark:text-ocean-teal"
                : "border border-ocean-mid/50 text-ocean-sand hover:border-ocean-teal/40",
            )}
          >
            {item.label} ({item.count})
          </button>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-ocean-mid/50 sm:inline" aria-hidden />
        <button
          type="button"
          disabled={loading || isPending || pageCounts.inactive === 0}
          onClick={activatePage}
          className={cn(
            FILTER_BTN,
            "border border-ocean-teal/40 text-ocean-teal-dim hover:bg-ocean-teal/10 dark:text-ocean-teal",
          )}
        >
          Activate page
        </button>
        <button
          type="button"
          disabled={loading || isPending || pageCounts.active === 0}
          onClick={deactivatePage}
          className={cn(
            FILTER_BTN,
            "border border-ocean-danger-border/60 text-ocean-danger hover:bg-ocean-danger-muted/50",
          )}
        >
          Deactivate page
        </button>
      </div>

      {message && (
        <p className="mb-2 text-ocean-teal-dim dark:text-ocean-teal">{message}</p>
      )}
      {error && <p className="mb-2 text-ocean-danger">{error}</p>}

      <TickersTable
        rows={pageTickers}
        loading={loading}
        pending={pending}
        bulkPending={isPending}
        onToggleActive={setActive}
        emptyMessage={
          search.trim()
            ? `No tickers match “${search.trim()}”.`
            : undefined
        }
      />

      <TickersPager
        page={page}
        totalPages={pages}
        totalItems={filteredCount}
        pageSize={pageSize}
        disabled={loading || isPending}
        onPageChange={setPage}
      />
    </CollapsibleSection>
  );
}
