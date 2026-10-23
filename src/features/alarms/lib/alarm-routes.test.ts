import { describe, expect, it } from "vitest";
import { ALARMS_TABS, alarmsPath, defaultAlarmsTab, isAlarmsTab } from "./alarm-routes";

describe("alarm-routes", () => {
  it("builds tab paths", () => {
    expect(alarmsPath("strategy")).toBe("/alarms/strategy");
    expect(alarmsPath("movement")).toBe("/alarms/movement");
    expect(alarmsPath()).toBe("/alarms/movement");
    expect(defaultAlarmsTab()).toBe("movement");
    expect(ALARMS_TABS[0]).toBe("movement");
  });

  it("accepts known tabs", () => {
    expect(isAlarmsTab("strategy")).toBe(true);
    expect(isAlarmsTab("movement")).toBe(true);
    expect(isAlarmsTab("alarm")).toBe(false);
  });
});
