import type { MarketAlarmWatch } from "./alarm-types";

const TERMINAL_STATES = new Set(["INVALIDATED", "EXITED", "COOLDOWN"]);

/** Time of a detected entry. An exit keeps that entry and does not supply its own mark. */
export function detectedEntryAt(
  watch: Pick<MarketAlarmWatch, "status" | "lastEntryAt" | "metAt">,
): string | null {
  if (watch.status !== "met" && watch.status !== "in_trade" && watch.status !== "exit") {
    return null;
  }
  const at = (watch.lastEntryAt || watch.metAt || "").trim();
  return at || null;
}

export function detectedEntrySide(
  watch: Pick<MarketAlarmWatch, "status" | "lastDetectedTrend">,
): "CALL" | "PUT" | null {
  if (watch.status !== "met" && watch.status !== "in_trade" && watch.status !== "exit") {
    return null;
  }
  if (watch.lastDetectedTrend === "alcista") return "CALL";
  if (watch.lastDetectedTrend === "bajista") return "PUT";
  return null;
}

function entryClock(iso: string): string | null {
  const match = /T(\d{2}):(\d{2})/.exec(iso) ?? / (\d{2}):(\d{2})/.exec(iso);
  if (match) return `${match[1]}:${match[2]}`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Thumbnail line: `10:36 : - CALL 42.09%`. */
export function lastEntryTitle(
  watch: Pick<
    MarketAlarmWatch,
    "status" | "lastEntryAt" | "metAt" | "lastDetectedTrend" | "lastOptionGainPct"
  >,
): string | null {
  const at = detectedEntryAt(watch);
  const operation = detectedEntrySide(watch);
  if (!at || !operation) return null;
  const time = entryClock(at);
  if (!time) return null;
  const gain = watch.lastOptionGainPct;
  const estimate =
    typeof gain === "number" && Number.isFinite(gain) ? `${gain.toFixed(2)}%` : null;
  return estimate ? `${time} : - ${operation} ${estimate}` : `${time} : - ${operation}`;
}

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
