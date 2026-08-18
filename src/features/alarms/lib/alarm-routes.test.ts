import { describe, expect, it } from "vitest";
import { alarmsPath, isAlarmsTab } from "./alarm-routes";

describe("alarm-routes", () => {
  it("builds tab paths", () => {
    expect(alarmsPath("strategy")).toBe("/alarms/strategy");
    expect(alarmsPath("movement")).toBe("/alarms/movement");
  });

  it("accepts known tabs", () => {
    expect(isAlarmsTab("strategy")).toBe(true);
    expect(isAlarmsTab("movement")).toBe(true);
    expect(isAlarmsTab("alarm")).toBe(false);
  });
});
