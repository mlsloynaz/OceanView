import { Link } from "react-router-dom";
import { operationsApiBaseUrl, operationsApiUsesMock } from "./api/operations-client";
import { OperationsTickerList } from "./components/OperationsTickerList";
import { OperationsToolbar } from "./components/OperationsToolbar";
import { OptionPicksTable } from "./components/OptionPicksTable";
import { useOperationsWorkspace } from "./hooks/useOperationsWorkspace";

export function OperationsPage() {
  const ws = useOperationsWorkspace();
  const usesMock = operationsApiUsesMock();
  const apiBase = operationsApiBaseUrl();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ocean-foam">Operations</h1>
        <p className="mt-2 text-ocean-sand">
          Option picks for tickers with <strong className="font-medium text-ocean-foam">Operation</strong>{" "}
          enabled and an optimal strike range. Enable symbols in{" "}
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

      <OperationsToolbar
        contractType={ws.contractType}
        selectedCount={ws.selectedSymbols.length}
        eligibleCount={ws.eligibleSymbols.length}
        picksPending={ws.picksPending}
        loading={ws.loadingTickers}
        onContractTypeChange={ws.setContractType}
        onSelectAll={ws.selectAllEligible}
        onRunPicks={ws.runPicks}
        onReload={ws.reloadTickers}
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
          {ws.selectedSymbols.length} selected
        </p>
        <OperationsTickerList
          tickers={ws.tickers}
          selected={ws.selected}
          loading={ws.loadingTickers}
          disabled={ws.picksPending}
          onToggle={ws.toggleSymbol}
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold text-ocean-foam">Option picks</h2>
        <OptionPicksTable
          picks={ws.picks}
          tickers={ws.tickers}
          buyingSymbol={ws.buyingSymbol}
          disabled={ws.picksPending}
          onBuy={ws.buyPick}
        />
      </section>
    </div>
  );
}
