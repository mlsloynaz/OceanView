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

function isCompleteResult(row: LabOrbBreakoutResult | null): boolean {
  if (!row) return false;
  const status = String(row.status || "").toLowerCase();
  if (status === "running" || status === "failed") return false;
  return Array.isArray(row.labels);
}

export function useLabOrbBreakoutResearch() {
  const [ticker, setTicker] = useState("TSLA");
  const [startDate, setStartDate] = useState(() => daysAgoEtDateInput(30));
  const [endDate, setEndDate] = useState(() => todayEtDateInput());
  const [barSource, setBarSource] = useState<"alpaca" | "stored">("alpaca");
  const [forwardBars, setForwardBars] = useState(8);
  const [followThresholdAtr, setFollowThresholdAtr] = useState(0.5);

  const [starting, setStarting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingCached, setLoadingCached] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<LabOrbBreakoutResult | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  const applyResultPayload = useCallback((payload: LabOrbBreakoutResult) => {
    const status = String(payload.status || "complete").toLowerCase();
    setJobStatus(status);
    if (status === "running") {
      setNotice(payload.message || "ORB research is running…");
      setError(null);
      return;
    }
    if (status === "failed") {
      setError(payload.error || "ORB research run failed");
      setNotice(null);
      return;
    }
    setResult(payload);
    setNotice(null);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCached(true);
      try {
        const cached = await fetchLabOrbBreakoutResult();
        if (!cancelled) applyResultPayload(cached);
      } catch {
        if (!cancelled) {
          setResult(null);
          setJobStatus(null);
        }
      } finally {
        if (!cancelled) setLoadingCached(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyResultPayload]);

  const refreshResult = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const next = await fetchLabOrbBreakoutResult();
      applyResultPayload(next);
      if (isCompleteResult(next)) {
        setNotice("Result refreshed.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh ORB result.");
    } finally {
      setRefreshing(false);
    }
  }, [applyResultPayload]);

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

    setStarting(true);
    setError(null);
    setNotice(null);
    try {
      const ack = await runLabOrbBreakoutResearch({
        ticker: sym,
        startDate,
        endDate,
        barSource,
        forwardBars,
        followThresholdAtr,
      });
      setJobStatus(ack.status);
      setNotice(ack.message || "ORB research started — use Refresh result when ready.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ORB breakout research failed.");
      setJobStatus(null);
    } finally {
      setStarting(false);
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
    starting,
    refreshing,
    loading: starting,
    loadingCached,
    error,
    notice,
    jobStatus,
    result,
    submit,
    refreshResult,
  };
}
