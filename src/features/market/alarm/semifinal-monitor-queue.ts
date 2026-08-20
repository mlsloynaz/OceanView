/**
 * Re-export canonical SemiFinal → Ready-to-monitor helpers.
 * SemiFinal Monitor enqueues idle watches on the Alarms board.
 */
export {
  buildSemifinalMonitorQueue,
  groupSemifinalMonitorQueue,
  type SemifinalMonitorCandidate,
  type SemifinalMonitorGroup,
} from "@/features/admin/setup-scan/semifinal-monitor-queue";
