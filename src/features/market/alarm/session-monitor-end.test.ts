import { describe, expect, it } from "vitest";
import {
  isActivelyMonitoringWatch,
  isSessionMonitorEnded,
} from "./session-monitor-end";

function etDate(isoLocal: string): Date {
  return new Date(`${isoLocal}-04:00`);
}

describe("session monitor end", () => {
  it("keeps monitoring before 4:00 PM ET", () => {
    expect(isSessionMonitorEnded(etDate("2026-08-18T15:59:00"))).toBe(false);
  });

  it("stops at 4:00 PM ET", () => {
    expect(isSessionMonitorEnded(etDate("2026-08-18T16:00:00"))).toBe(true);
    expect(isSessionMonitorEnded(etDate("2026-08-18T16:01:00"))).toBe(true);
  });

  it("treats running and in-trade watches as active", () => {
    expect(isActivelyMonitoringWatch({ status: "running" })).toBe(true);
    expect(isActivelyMonitoringWatch({ status: "in_trade" })).toBe(true);
    expect(isActivelyMonitoringWatch({ status: "idle" })).toBe(false);
    expect(isActivelyMonitoringWatch({ status: "stopped" })).toBe(false);
  });
});
