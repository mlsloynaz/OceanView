import { describe, expect, it } from "vitest";
import {
  E03_CONFIRM_RULE_KEY,
  easternClockMinutes,
  filterExpiredE03ConfirmQueue,
  isE03ConfirmExpired,
  isE03ConfirmWatch,
} from "./e03-confirm-window";
import type { SemifinalMonitorCandidate } from "@/features/admin/setup-scan/semifinal-monitor-queue";

function etDate(isoLocal: string): Date {
  return new Date(`${isoLocal}-04:00`);
}

describe("e03 confirm window", () => {
  it("is open before 9:45 AM ET", () => {
    expect(isE03ConfirmExpired(etDate("2026-08-18T09:44:00"))).toBe(false);
    expect(easternClockMinutes(etDate("2026-08-18T09:44:00"))).toBe(9 * 60 + 44);
  });

  it("closes at 9:45 AM ET", () => {
    expect(isE03ConfirmExpired(etDate("2026-08-18T09:45:00"))).toBe(true);
    expect(isE03ConfirmExpired(etDate("2026-08-18T10:01:00"))).toBe(true);
  });

  it("detects Confirmación E03 watches", () => {
    expect(
      isE03ConfirmWatch({
        ruleKey: E03_CONFIRM_RULE_KEY,
        ruleKeys: [E03_CONFIRM_RULE_KEY],
      }),
    ).toBe(true);
    expect(
      isE03ConfirmWatch({
        ruleKey: "confirmation_change_trend_1h",
        ruleKeys: ["confirmation_change_trend_1h"],
      }),
    ).toBe(false);
  });

  it("drops E03 rows from the SemiFinal queue after 9:45", () => {
    const rows = [
      { confirmRuleKey: "confirmation_change_trend_1h", symbol: "AAPL" },
      { confirmRuleKey: E03_CONFIRM_RULE_KEY, symbol: "NVDA" },
    ] as SemifinalMonitorCandidate[];
    const open = filterExpiredE03ConfirmQueue(rows, etDate("2026-08-18T09:40:00"));
    expect(open).toHaveLength(2);
    const closed = filterExpiredE03ConfirmQueue(rows, etDate("2026-08-18T09:45:00"));
    expect(closed.map((r) => r.symbol)).toEqual(["AAPL"]);
  });
});
