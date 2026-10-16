import { describe, expect, it } from "vitest";
import { alarmAlreadyPassed, enterAlreadyListed } from "./existing-alarm";

describe("alarmAlreadyPassed", () => {
  it("is quiet when the entry printed before this job start", () => {
    expect(
      alarmAlreadyPassed({
        silenceInitialMet: true,
        met: true,
        ruleStatus: "met",
        entryAt: "2026-10-15T10:35:00-04:00",
        jobStartedAt: "2026-10-15T14:40:00Z",
      }),
    ).toBe(true);
  });

  it("still rings when the entry prints after the job starts", () => {
    expect(
      alarmAlreadyPassed({
        silenceInitialMet: true,
        met: true,
        ruleStatus: "met",
        entryAt: "2026-10-15T11:05:00-04:00",
        jobStartedAt: "2026-10-15T14:40:00Z",
      }),
    ).toBe(false);
  });

  it("waits while the first check is still pending", () => {
    expect(
      alarmAlreadyPassed({
        silenceInitialMet: true,
        met: false,
        ruleStatus: "pending",
        entryAt: null,
        jobStartedAt: "2026-10-15T14:40:00Z",
      }),
    ).toBe(false);
  });

  it("treats a met alarm with no entry clock as already in place", () => {
    expect(
      alarmAlreadyPassed({
        silenceInitialMet: true,
        met: true,
        ruleStatus: "met",
        entryAt: null,
        jobStartedAt: "2026-10-15T14:40:00Z",
      }),
    ).toBe(true);
  });
});

describe("enterAlreadyListed", () => {
  it("matches the same symbol, rules, and evidence", () => {
    expect(
      enterAlreadyListed(
        [
          {
            symbol: "AAPL",
            kind: "enter",
            ruleKeys: ["trend_change_5m"],
            evidence: "5m trend change CALL",
            tradeDate: "2026-10-15",
          },
        ],
        {
          symbol: "aapl",
          ruleKeys: ["trend_change_5m"],
          evidence: "5m trend change CALL",
          entryAt: "2026-10-15T10:35:00-04:00",
        },
      ),
    ).toBe(true);
  });

  it("does not match a different movement", () => {
    expect(
      enterAlreadyListed(
        [
          {
            symbol: "AAPL",
            kind: "enter",
            ruleKeys: ["trend_change_15m"],
            evidence: "15m trend change",
            tradeDate: "2026-10-15",
          },
        ],
        {
          symbol: "AAPL",
          ruleKeys: ["trend_change_5m"],
          evidence: "15m trend change",
          entryAt: "2026-10-15T10:35:00-04:00",
        },
      ),
    ).toBe(false);
  });
});
