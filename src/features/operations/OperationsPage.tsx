import { Link } from "react-router-dom";
import { operationsApiBaseUrl, operationsApiUsesMock } from "./api/operations-client";
import { OperationsEligibilitySearch } from "./components/OperationsEligibilitySearch";
import { OperationsTickerList } from "./components/OperationsTickerList";
import { OperationsToolbar } from "./components/OperationsToolbar";
import { OptionPicksTable } from "./components/OptionPicksTable";
import { useOperationsWorkspace } from "./hooks/useOperationsWorkspace";

export function OperationsPage() {
  const ws = useOperationsWorkspace();
  const usesMock = operationsApiUsesMock();
  const apiBase = operationsApiBaseUrl();
  const busy = ws.picksPending || Object.keys(ws.enablePending).length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ocean-foam">Operations</h1>
        <p className="mt-2 text-ocean-sand">
          Search the catalog to enable tickers for Operations, then run option picks on those with an
          optimal strike range. Catalog names live in{" "}
          <Link to="/admin#admin-tickers-pane" className="text-ocean-teal hover:underline">
            Admin → Tickers
          </Link>
          .
        </p>
      </div>

      {usesMock ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          Mock mode (`VITE_USE_MOCK_OPERATIONS=true`) — picks and buys stay in-memory.
        </p>
      ) : apiBase ? (
        <p className="truncate text-[11px] text-ocean-sand/70" title={apiBase}>
          API: {apiBase}
        </p>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold text-ocean-foam">Eligibility</h2>
        <OperationsEligibilitySearch
          query={ws.searchQuery}
          results={ws.searchResults}
          pending={ws.enablePending}
          disabled={busy}
          catalogLoading={ws.loadingCatalog}
          onQueryChange={ws.setSearchQuery}
          onToggleEnable={ws.setOperationEnable}
        />
      </section>

      <OperationsToolbar
        contractType={ws.contractType}
        selectedCount={ws.selectedSymbols.length}
        eligibleCount={ws.eligibleSymbols.length}
        picksPending={ws.picksPending}
        loading={ws.loadingTickers}
        onContractTypeChange={ws.setContractType}
        onSelectAll={ws.selectAllEligible}
        onRunPicks={ws.runPicks}
        onReload={() => void ws.reloadTickers()}
      />

      {ws.notice ? (
        <p className="text-sm text-ocean-teal-dim dark:text-ocean-teal" role="status">
          {ws.notice}
        </p>
      ) : null}
      {ws.error ? (
        <p className="text-sm text-ocean-danger" role="alert">
          {ws.error}
        </p>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold text-ocean-foam">Universe</h2>
        <p className="text-xs text-ocean-sand">
          {ws.tickers.length} operation-enabled · {ws.eligibleSymbols.length} with optimal range ·{" "}
          {ws.selectedSymbols.length} selected for picks
        </p>
        <OperationsTickerList
          tickers={ws.tickers}
          selected={ws.selected}
          loading={ws.loadingTickers}
          disabled={busy}
          onToggle={ws.toggleSymbol}
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold text-ocean-foam">Option picks</h2>
        <OptionPicksTable
          picks={ws.picks}
          tickers={ws.tickers}
          buyingSymbol={ws.buyingSymbol}
          disabled={busy}
          onBuy={ws.buyPick}
        />
      </section>
    </div>
  );
}
