import { useCallback, useEffect, useState } from "react";
import { fetchLabOrbBreakoutResult, runLabOrbBreakoutResearch } from "../api/lab-client";
import type { LabOrbBreakoutResult } from "../types-orb-breakout";

function todayEtDateInput(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function daysAgoEtDateInput(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function useLabOrbBreakoutResearch() {
  const [ticker, setTicker] = useState("TSLA");
  const [startDate, setStartDate] = useState(() => daysAgoEtDateInput(30));
  const [endDate, setEndDate] = useState(() => todayEtDateInput());
  const [barSource, setBarSource] = useState<"alpaca" | "stored">("alpaca");
  const [forwardBars, setForwardBars] = useState(8);
  const [followThresholdAtr, setFollowThresholdAtr] = useState(0.5);

  const [loading, setLoading] = useState(false);
  const [loadingCached, setLoadingCached] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LabOrbBreakoutResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCached(true);
      try {
        const cached = await fetchLabOrbBreakoutResult();
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
      const next = await runLabOrbBreakoutResearch({
        ticker: sym,
        startDate,
        endDate,
        barSource,
        forwardBars,
        followThresholdAtr,
      });
      setResult(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ORB breakout research failed.");
    } finally {
      setLoading(false);
    }
  }, [ticker, startDate, endDate, barSource, forwardBars, followThresholdAtr]);

  return {
    ticker,
    setTicker,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    barSource,
    setBarSource,
    forwardBars,
    setForwardBars,
    followThresholdAtr,
    setFollowThresholdAtr,
    loading,
    loadingCached,
    error,
    result,
    submit,
  };
}
