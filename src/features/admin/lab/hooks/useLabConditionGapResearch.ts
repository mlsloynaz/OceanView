import { useCallback, useEffect, useState } from "react";
import {
  fetchLabConditionGapResult,
  runLabConditionGapResearch,
} from "../api/lab-client";
import type { LabConditionGapResult } from "../types-condition-gap";

function todayEtDateInput(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function daysAgoEtDateInput(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function useLabConditionGapResearch() {
  const [ticker, setTicker] = useState("SPY");
  const [startDate, setStartDate] = useState(() => daysAgoEtDateInput(10));
  const [endDate, setEndDate] = useState(() => todayEtDateInput());
  const [intake, setIntake] = useState(true);

  const [loading, setLoading] = useState(false);
  const [loadingCached, setLoadingCached] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LabConditionGapResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCached(true);
      try {
        const cached = await fetchLabConditionGapResult();
        if (!cancelled) setResult(cached);
      } catch {
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
    const sym = ticker.trim().toUpperCase();
    if (!sym) {
      setError("Ticker is required.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Start and end dates are required.");
      return;
    }
    if (startDate > endDate) {
      setError("Start date must be on or before end date.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await runLabConditionGapResearch({
        ticker: sym,
        startDate,
        endDate,
        temporality: "15m",
        intake,
      });
      setResult(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Condition-gap research failed.");
    } finally {
      setLoading(false);
    }
  }, [ticker, startDate, endDate, intake]);

  return {
    ticker,
    setTicker,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    intake,
    setIntake,
    loading,
    loadingCached,
    error,
    result,
    submit,
  };
}
