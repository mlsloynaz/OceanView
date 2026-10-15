import { describe, expect, it } from "vitest";
import {
  applyFiveMinuteEntryEvent,
  movementStateLabel,
  optionRoomLine,
  shadowComparisonVisible,
} from "./five-minute-entry";

const eventId = "TC5|SPY|CALL|2026-10-12T10:36:00-04:00";

describe("applyFiveMinuteEntryEvent", () => {
  it("shows a new early event once", () => {
    const first = applyFiveMinuteEntryEvent(
      { lastEntryEventId: null },
      { entryEvent: true, entryEventId: eventId, movementState: "ENTRY_READY" },
    );
    expect(first).toEqual({ lastEntryEvent: true, lastEntryEventId: eventId });
  });

  it("does not show New again for the same event id", () => {
    const again = applyFiveMinuteEntryEvent(
      { lastEntryEventId: eventId },
      { entryEvent: true, entryEventId: eventId, movementState: "ENTRY_READY" },
    );
    expect(again.lastEntryEvent).toBe(false);
    expect(again.lastEntryEventId).toBe(eventId);
  });

  it("shows New for a later event id", () => {
    const nextId = "TC5|SPY|PUT|2026-10-12T11:05:00-04:00";
    const next = applyFiveMinuteEntryEvent(
      { lastEntryEventId: eventId },
      { entryEvent: true, entryEventId: nextId, movementState: "ENTRY_READY" },
    );
    expect(next).toEqual({ lastEntryEvent: true, lastEntryEventId: nextId });
  });

  it("clears New when the movement is invalidated or expired", () => {
    expect(
      applyFiveMinuteEntryEvent(
        { lastEntryEventId: null },
        { entryEvent: true, entryEventId: eventId, movementState: "INVALIDATED" },
      ).lastEntryEvent,
    ).toBe(false);
    expect(
      applyFiveMinuteEntryEvent(
        { lastEntryEventId: eventId },
        { entryEvent: true, entryEventId: eventId, movementState: "COOLDOWN" },
      ).lastEntryEvent,
    ).toBe(false);
    expect(movementStateLabel("INVALIDATED")).toBe("Invalidated");
    expect(movementStateLabel("COOLDOWN")).toBe("Expired");
  });
});

describe("shadowComparisonVisible", () => {
  it("stays visible when the shadow path matches the live path", () => {
    expect(
      shadowComparisonVisible({
        entryPath: "early_continuation",
        movementState: "ENTRY_READY",
        triggerType: "pullback_recovery",
      }),
    ).toBe(true);
  });
});

describe("optionRoomLine", () => {
  it("uses the backend gain fields and ignores a different shadow number", () => {
    const line = optionRoomLine({
      lastOptionGainPct: 14.5,
      lastRoomByPath: {
        confirmed_5m: { optionGainPct: 8 },
        early: { optionGainPct: 14.5 },
      },
    });
    expect(line).toBe("Option room · 14.5% · confirmed 8% · early 14.5%");
  });
});
