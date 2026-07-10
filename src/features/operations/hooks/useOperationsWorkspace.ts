import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  fetchOperationsTickers,
  fetchOptionPicks,
  operationsApiUsesMock,
  postBuyOption,
} from "../api/operations-client";
import type {
  ContractType,
  OperationsTicker,
  OptionPickResult,
  OptionPicksResponse,
} from "../types";

export function useOperationsWorkspace() {
  const useMock = operationsApiUsesMock();
  const [tickers, setTickers] = useState<OperationsTicker[]>([]);
  const [contractType, setContractType] = useState<ContractType>("CALL");
  const [picks, setPicks] = useState<OptionPicksResponse | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loadingTickers, setLoadingTickers] = useState(true);
  const [picksPending, setPicksPending] = useState(false);
  const [buyingSymbol, setBuyingSymbol] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const loadTickers = useCallback(async () => {
    setLoadingTickers(true);
    setError(null);
    try {
      const rows = await fetchOperationsTickers();
      setTickers(rows);
      setSelected((prev) => {
        const next: Record<string, boolean> = {};
        for (const row of rows) {
          if (row.optimalRange) {
            next[row.symbol] = prev[row.symbol] ?? true;
          }
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load operations tickers.");
    } finally {
      setLoadingTickers(false);
    }
  }, []);

  useEffect(() => {
    void loadTickers();
  }, [loadTickers]);

  const eligibleSymbols = useMemo(
    () => tickers.filter((row) => row.optimalRange).map((row) => row.symbol),
    [tickers],
  );

  const selectedSymbols = useMemo(
    () => eligibleSymbols.filter((symbol) => selected[symbol]),
    [eligibleSymbols, selected],
  );

  const toggleSymbol = useCallback((symbol: string, checked: boolean) => {
    setSelected((prev) => ({ ...prev, [symbol]: checked }));
  }, []);

  const selectAllEligible = useCallback(
    (checked: boolean) => {
      setSelected((prev) => {
        const next = { ...prev };
        for (const symbol of eligibleSymbols) {
          next[symbol] = checked;
        }
        return next;
      });
    },
    [eligibleSymbols],
  );

  const runPicks = useCallback(() => {
    if (selectedSymbols.length === 0) {
      setError("Select at least one ticker with an optimal range.");
      return;
    }
    setError(null);
    setNotice(null);
    setPicksPending(true);
    startTransition(async () => {
      try {
        const payload = await fetchOptionPicks(contractType, selectedSymbols);
        setPicks(payload);
        const ok = payload.results.filter((row) => row.status === "ok").length;
        setNotice(
          `Option picks ready — ${ok} ok of ${payload.results.length} for ${payload.contractType}.`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to evaluate option picks.");
      } finally {
        setPicksPending(false);
      }
    });
  }, [contractType, selectedSymbols]);

  const buyPick = useCallback(
    (row: OptionPickResult) => {
      if (!row.pick) return;
      const ticker = tickers.find((item) => item.symbol === row.symbol);
      if (ticker?.position && !ticker.position.canBuy) {
        setError(`${row.symbol} already has an open position.`);
        return;
      }
      const ok = window.confirm(
        `Buy 1 ${row.pick.putCall} ${row.symbol} ${row.pick.strike} exp ${row.pick.expiration}? This places a live market order.`,
      );
      if (!ok) return;

      setError(null);
      setNotice(null);
      setBuyingSymbol(row.symbol);
      startTransition(async () => {
        try {
          const result = await postBuyOption({
            symbol: row.symbol,
            optionSymbol: row.pick!.optionSymbol,
            contractType: row.pick!.putCall,
            quantity: 1,
            strike: row.pick!.strike,
            expiration: row.pick!.expiration,
            ask: row.pick!.ask,
            bid: row.pick!.bid,
            mark: row.pick!.mark,
          });
          setNotice(
            result.message ??
              `${result.symbol} ${result.status}${result.tradePrice != null ? ` @ ${result.tradePrice}` : ""}.`,
          );
          await loadTickers();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Buy failed.");
        } finally {
          setBuyingSymbol(null);
        }
      });
    },
    [loadTickers, tickers],
  );

  return {
    useMock,
    tickers,
    contractType,
    setContractType,
    picks,
    selected,
    selectedSymbols,
    eligibleSymbols,
    loadingTickers,
    picksPending,
    buyingSymbol,
    error,
    notice,
    reloadTickers: loadTickers,
    toggleSymbol,
    selectAllEligible,
    runPicks,
    buyPick,
  };
}
