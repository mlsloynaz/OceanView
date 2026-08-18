/**
 * Re-export canonical SemiFinal → Ready-to-monitor helpers.
 * Queue logic lives under setup-scan; Start monitoring UI is Alarms → Strategy confirms.
 */
export {
  buildSemifinalMonitorQueue,
  groupSemifinalMonitorQueue,
  type SemifinalMonitorCandidate,
  type SemifinalMonitorGroup,
} from "@/features/admin/setup-scan/semifinal-monitor-queue";
