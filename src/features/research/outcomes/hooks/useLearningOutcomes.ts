import { useCallback, useEffect, useState } from "react";
import {
  getLearningJobStatus,
  getLearningOutcome,
  learningApiBaseUrl,
  learningUsesMock,
  listLearningObservations,
  runLearningOutcomes,
} from "../api/learning-client";
import type {
  LearningJobSummary,
  LearningObservation,
  LearningOutcome,
  LearningOutcomesRunResponse,
} from "../types";

export type OutcomeFilter = "pending" | "complete" | "skipped";

export function useLearningOutcomes() {
  const [filter, setFilter] = useState<OutcomeFilter>("pending");
  const [observations, setObservations] = useState<LearningObservation[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [completeCount, setCompleteCount] = useState(0);
  const [job, setJob] = useState<LearningJobSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedObs, setSelectedObs] = useState<LearningObservation | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<LearningOutcome | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pending, complete, jobStatus, skipped] = await Promise.all([
        listLearningObservations("pending", 50),
        listLearningObservations("complete", 50),
        getLearningJobStatus(),
        filter === "skipped"
          ? listLearningObservations("skipped", 50)
          : Promise.resolve(null),
      ]);
      setPendingCount(pending.count ?? 0);
      setCompleteCount(complete.count ?? 0);
      setJob(jobStatus);
      if (filter === "pending") setObservations(pending.observations ?? []);
      else if (filter === "complete") setObservations(complete.observations ?? []);
      else setObservations(skipped?.observations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load learning data");
      setObservations([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openDetail = useCallback(async (obs: LearningObservation) => {
    setSelectedId(obs.observationId);
    setSelectedObs(obs);
    setSelectedOutcome(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      if (obs.outcomeStatus === "complete") {
        const outcome = await getLearningOutcome(obs.observationId);
        setSelectedOutcome(outcome);
      }
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to load outcome");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedId(null);
    setSelectedObs(null);
    setSelectedOutcome(null);
    setDetailError(null);
  }, []);

  const runNow = useCallback(
    async (sync = false) => {
      setRunning(true);
      setRunMessage(null);
      setError(null);
      try {
        const result: LearningOutcomesRunResponse = await runLearningOutcomes({
          limit: 50,
          sync,
        });
        if (result.status === "queued") {
          setRunMessage(result.message ?? "Outcome worker queued.");
        } else if (result.summary) {
          const s = result.summary;
          setRunMessage(
            `Scanned ${s.scanned ?? 0} · completed ${s.completed ?? 0} · still pending ${s.stillPending ?? 0} · skipped ${s.skipped ?? 0}`,
          );
        } else {
          setRunMessage(`Run finished (${result.status}).`);
        }
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Run failed");
      } finally {
        setRunning(false);
      }
    },
    [refresh],
  );

  return {
    filter,
    setFilter,
    observations,
    pendingCount,
    completeCount,
    job,
    loading,
    error,
    running,
    runMessage,
    refresh,
    runNow,
    selectedId,
    selectedObs,
    selectedOutcome,
    detailLoading,
    detailError,
    openDetail,
    closeDetail,
    usesMock: learningUsesMock(),
    apiBase: learningApiBaseUrl(),
  };
}
