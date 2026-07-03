import { useCallback, useEffect, useState, useTransition } from "react";
import { patchTickerActive } from "../../tickers/api/tickers-client";
import { getSetupScanResult, postSetupScanRun } from "../api/preselection-client";
import type { PreselectionResultResponse, PreselectionTickerRow } from "../types";

export function useSetupScanPane(open: boolean) {
  const [result, setResult] = useState<PreselectionResultResponse | null>(null);
  const [minScore, setMinScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [runPending, startRunTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tickerPending, setTickerPending] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<{
    strategyName: string;
    ticker: PreselectionTickerRow;
  } | null>(null);

  const loadResult = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await getSetupScanResult();
      setResult(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load setup scan result.";
      if (!msg.toLowerCase().includes("not found")) {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadResult();
  }, [open, loadResult]);

  const runScan = useCallback(() => {
    startRunTransition(async () => {
      setError(null);
      setMessage(null);
      try {
        const payload = await postSetupScanRun({ minScore });
        setResult(payload);
        setMessage(payload.message ?? "Setup scan complete.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Setup scan failed.");
      }
    });
  }, [minScore]);

  const setActive = useCallback(async (symbol: string, active: boolean) => {
    const upper = symbol.trim().toUpperCase();
    setTickerPending((prev) => ({ ...prev, [upper]: true }));
    setError(null);
    try {
      await patchTickerActive(upper, active);
      setResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          strategies: prev.strategies.map((group) => ({
            ...group,
            tickers: group.tickers.map((row) =>
              row.symbol === upper ? { ...row, currentlyActive: active } : row,
            ),
          })),
        };
      });
      setMessage(`${upper} ${active ? "activated" : "deactivated"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ticker update failed.");
    } finally {
      setTickerPending((prev) => {
        const next = { ...prev };
        delete next[upper];
        return next;
      });
    }
  }, []);

  return {
    result,
    minScore,
    setMinScore,
    loading,
    runPending,
    error,
    message,
    tickerPending,
    detail,
    setDetail,
    loadResult,
    runScan,
    setActive,
  };
}
