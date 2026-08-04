import { useCallback, useEffect, useState } from "react";
import { fetchLabE05SaliendoResult, runLabE05SaliendoResearch } from "../api/lab-client";
import type { LabE05SaliendoResult } from "../types-e05-saliendo";

function todayEtDateInput(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function daysAgoEtDateInput(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function useLabE05SaliendoResearch() {
  const [startDate, setStartDate] = useState(() => daysAgoEtDateInput(10));
  const [endDate, setEndDate] = useState(() => todayEtDateInput());
  const [symbolsText, setSymbolsText] = useState("NFLX,SPY,QQQ");
  const [forwardBars, setForwardBars] = useState(8);
  const [includeBreakout, setIncludeBreakout] = useState(true);

  const [loading, setLoading] = useState(false);
  const [loadingCached, setLoadingCached] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LabE05SaliendoResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCached(true);
      try {
        const cached = await fetchLabE05SaliendoResult();
        if (!cancelled) setResult(cached);
      } catch {
        // 404 = no prior run — fine
        if (!cancelled) setResult(null);
      } finally {
        if (!cancelled) setLoadingCached(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = useCallback(async () => {
    if (!startDate || !endDate) {
      setError("Start and end dates are required.");
      return;
    }
    if (startDate > endDate) {
      setError("Start date must be on or before end date.");
      return;
    }
    const symbols = symbolsText
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    setLoading(true);
    setError(null);
    try {
      const next = await runLabE05SaliendoResearch({
        startDate,
        endDate,
        ...(symbols.length ? { symbols } : {}),
        forwardBars,
        includeBreakout,
      });
      setResult(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "E05 saliendo research failed.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, symbolsText, forwardBars, includeBreakout]);

  return {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    symbolsText,
    setSymbolsText,
    forwardBars,
    setForwardBars,
    includeBreakout,
    setIncludeBreakout,
    loading,
    loadingCached,
    error,
    result,
    submit,
  };
}
