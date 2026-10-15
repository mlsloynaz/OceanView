import type { MarketAlarmWatch } from "./alarm-types";

const TERMINAL_STATES = new Set(["INVALIDATED", "EXITED", "COOLDOWN"]);

export function movementStateLabel(state: string | null | undefined): string | null {
  if (!state) return null;
  if (state === "INVALIDATED") return "Invalidated";
  if (state === "COOLDOWN") return "Expired";
  if (state === "EXITED") return "Exited";
  if (state === "ENTRY_READY") return "Entry ready";
  if (state === "ACTIVE") return "Active";
  if (state === "DEVELOPING_5M") return "Developing";
  if (state === "OPPORTUNITY_DETECTED") return "Opportunity";
  if (state === "IDLE") return "Idle";
  return state;
}

export function applyFiveMinuteEntryEvent(
  previous: { lastEntryEventId?: string | null },
  incoming: {
    entryEvent?: boolean | null;
    entryEventId?: string | null;
    movementState?: string | null;
  },
): { lastEntryEvent: boolean; lastEntryEventId: string | null } {
  const incomingId =
    typeof incoming.entryEventId === "string" && incoming.entryEventId.trim()
      ? incoming.entryEventId
      : null;
  const previousId = previous.lastEntryEventId ?? null;
  const repeated = incomingId != null && incomingId === previousId;
  const terminal = typeof incoming.movementState === "string" && TERMINAL_STATES.has(incoming.movementState);
  const showNew = incoming.entryEvent === true && incomingId != null && !repeated && !terminal;
  return {
    lastEntryEvent: showNew,
    lastEntryEventId: incomingId ?? previousId,
  };
}

export function shadowComparisonVisible(
  shadow: { entryPath?: string | null; movementState?: string | null; triggerType?: string | null } | null | undefined,
): boolean {
  if (!shadow) return false;
  return Boolean(shadow.entryPath || shadow.movementState || shadow.triggerType);
}

function finiteGain(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function optionRoomLine(watch: Pick<MarketAlarmWatch, "lastOptionGainPct" | "lastRoomByPath">): string | null {
  const active = finiteGain(watch.lastOptionGainPct);
  const confirmed = finiteGain(watch.lastRoomByPath?.confirmed_5m?.optionGainPct);
  const early = finiteGain(watch.lastRoomByPath?.early?.optionGainPct);
  const parts: string[] = [];
  if (active != null) parts.push(`${active}%`);
  if (confirmed != null) parts.push(`confirmed ${confirmed}%`);
  if (early != null) parts.push(`early ${early}%`);
  if (parts.length === 0) return null;
  return `Option room · ${parts.join(" · ")}`;
}
