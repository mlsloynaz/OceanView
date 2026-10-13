import { useCallback, useEffect, useState } from "react";
import {
  startMovementWatchJob,
  stopMovementWatchJob,
} from "@/features/market/alarm/alarm-client";
import { getJobsStatus } from "../api/jobs-status-client";
import { cardsFromJobs } from "../display";
import type { JobStatusCardModel } from "../types";

export function useJobsStatusPane(open: boolean) {
  const [cards, setCards] = useState<JobStatusCardModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyJob, setBusyJob] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getJobsStatus();
      setCards(cardsFromJobs(response.jobs));
    } catch (err) {
      setCards([]);
      setError(err instanceof Error ? err.message : "Failed to load job status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void reload();
  }, [open, reload]);

  const startMovementWatch = useCallback(async () => {
    setBusyJob("movement_watch");
    setError(null);
    try {
      await startMovementWatchJob({ trigger: "manual" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start Movement Watch.");
    } finally {
      setBusyJob(null);
    }
  }, [reload]);

  const stopMovementWatch = useCallback(async () => {
    setBusyJob("movement_watch");
    setError(null);
    try {
      await stopMovementWatchJob("cancelled");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop Movement Watch.");
    } finally {
      setBusyJob(null);
    }
  }, [reload]);

  return {
    cards,
    loading,
    error,
    reload,
    busyJob,
    startMovementWatch,
    stopMovementWatch,
  };
}
