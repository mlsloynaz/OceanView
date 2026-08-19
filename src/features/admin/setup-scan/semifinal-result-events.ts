/**
 * Cross-pane signal: a Tickers SemiFinal run finished.
 * Alarms confirm-queue listens and reloads eligible names.
 */
export const SEMIFINAL_RESULT_CHANGED_EVENT = "oceanview.semifinal.result-changed";
export const SEMIFINAL_RESULT_CHANGED_AT_KEY = "oceanview.semifinal.result-changed-at";
export const SEMIFINAL_MONITOR_QUEUE_CLEARED_KEY = "oceanview.semifinal.monitor-queue.cleared";

export function isSemifinalMonitorQueueCleared(): boolean {
  try {
    return sessionStorage.getItem(SEMIFINAL_MONITOR_QUEUE_CLEARED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markSemifinalMonitorQueueCleared(): void {
  try {
    sessionStorage.setItem(SEMIFINAL_MONITOR_QUEUE_CLEARED_KEY, "1");
  } catch {
    /* ignore quota */
  }
}

export function clearSemifinalMonitorQueueCleared(): void {
  try {
    sessionStorage.removeItem(SEMIFINAL_MONITOR_QUEUE_CLEARED_KEY);
  } catch {
    /* ignore */
  }
}

export function notifySemifinalResultChanged(detail?: {
  mode?: string;
  runId?: string;
}): void {
  clearSemifinalMonitorQueueCleared();
  try {
    localStorage.setItem(SEMIFINAL_RESULT_CHANGED_AT_KEY, String(Date.now()));
  } catch {
    /* ignore quota */
  }
  window.dispatchEvent(
    new CustomEvent(SEMIFINAL_RESULT_CHANGED_EVENT, { detail: detail ?? {} }),
  );
}
