import { cn } from "@/shared/lib/cn";
import { AdminExpandedPane } from "@/features/admin/components/AdminExpandedPane";
import { AddTickerForm } from "./AddTickerForm";
import { tickersApiBaseUrl, tickersApiUsesMock } from "./api/tickers-client";
import { useTickersPane } from "./hooks/useTickersPane";
import { TickersPager } from "./TickersPager";
import { TickersTable } from "./TickersTable";
import { TickerCatalogSearch } from "./TickerCatalogSearch";
import type { TickerCatalogFilter } from "./types";

const FILTER_BTN =
  "rounded px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-50";

type Props = {
  onBack: () => void;
};

export function WatchlistPane({ onBack }: Props) {
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
    pageActiveState,
    loading,
    error,
    message,
    pending,
    isPending,
    adding,
    expandedSymbol,
    toggleExpanded,
    profileCache,
    reload,
    addTicker,
    activatePage,
    deactivatePage,
    activateAll,
    deactivateAll,
    setActive,
  } = useTickersPane(true);

  const filters: { id: TickerCatalogFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.total },
    { id: "active", label: "Active", count: counts.active },
    { id: "inactive", label: "Inactive", count: counts.inactive },
  ];

  return (
    <AdminExpandedPane
      id="admin-tickers-watchlist"
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded border border-ocean-mid/50 px-2 py-0.5 text-xs font-medium text-ocean-sand hover:border-ocean-teal/50 hover:text-ocean-foam"
          >
            ← Tickers
          </button>
          <span>Watchlist</span>
        </span>
      }
      subtitle={
        usesMock
          ? "Mock data (VITE_USE_MOCK_CANDLES=true)"
          : `Live API${apiBase ? ` — ${apiBase}` : ""}`
      }
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
      <p className="mb-3 text-xs text-ocean-sand">
        Catalog sorted A–Z, {pageSize} per page. Click a symbol for movement info. Active tickers
        are included in Market Assess and Candles bulk refresh.
      </p>

      <AddTickerForm disabled={loading || isPending} submitting={adding} onSubmit={addTicker} />

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
          disabled={loading || isPending || counts.inactive === 0}
          onClick={activateAll}
          className={cn(
            FILTER_BTN,
            "border border-ocean-teal/40 text-ocean-teal-dim hover:bg-ocean-teal/10 dark:text-ocean-teal",
          )}
        >
          Activate all
        </button>
        <button
          type="button"
          disabled={loading || isPending || counts.active === 0}
          onClick={deactivateAll}
          className={cn(
            FILTER_BTN,
            "border border-ocean-danger-border/60 text-ocean-danger hover:bg-ocean-danger-muted/50",
          )}
        >
          Deactivate all
        </button>
      </div>

      {message ? <p className="mb-2 text-ocean-teal-dim dark:text-ocean-teal">{message}</p> : null}
      {error ? <p className="mb-2 text-ocean-danger">{error}</p> : null}

      <TickersTable
        rows={pageTickers}
        loading={loading}
        pending={pending}
        bulkPending={isPending}
        pageActiveState={pageActiveState}
        expandedSymbol={expandedSymbol}
        profileCache={profileCache}
        onToggleExpanded={toggleExpanded}
        onPageActiveChange={(active) => (active ? activatePage() : deactivatePage())}
        onToggleActive={setActive}
        emptyMessage={search.trim() ? `No tickers match “${search.trim()}”.` : undefined}
      />

      <TickersPager
        page={page}
        totalPages={pages}
        totalItems={filteredCount}
        pageSize={pageSize}
        disabled={loading || isPending}
        onPageChange={setPage}
      />
    </AdminExpandedPane>
  );
}
