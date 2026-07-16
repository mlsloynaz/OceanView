import { useCallback, useEffect, useState } from "react";
import { getJobsStatus } from "../api/jobs-status-client";
import { cardsFromJobs } from "../display";
import type { JobStatusCardModel } from "../types";

export function useJobsStatusPane(open: boolean) {
  const [cards, setCards] = useState<JobStatusCardModel[]>([]);
  const [loading, setLoading] = useState(false);
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

  return { cards, loading, error, reload };
}
