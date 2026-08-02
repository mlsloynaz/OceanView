import { describe, expect, it } from "vitest";
import { adaptMarketTickerCard, adaptMarketTickerCards } from "../adapters/fromMarket";
import {
  adaptPremarketBestHit,
  adaptPremarketTickerHit,
} from "../adapters/fromPremarket";
import {
  buildRankComponents,
  readinessFromRules,
  tradabilityFromTier,
} from "../lib/normalize";
import type { TickerCardModel } from "@/features/market/types";
import type { PremarketBestResultRow, PremarketTickerHit } from "@/features/premarket/types";

describe("readinessFromRules", () => {
  it("maps all met required rules to confirmed", () => {
    expect(
      readinessFromRules(
        [
          { label: "A", status: "met", type: "required" },
          { label: "B", status: "met", type: "required" },
        ],
        100,
      ),
    ).toBe("confirmed");
  });

  it("uses preselectionNear gate instead of partial playbook rules", () => {
    expect(
      readinessFromRules(
        [
          { label: "A", status: "met", type: "required" },
          { label: "B", status: "partial", type: "required" },
        ],
        75,
        { preselectionNear: false, preselectionNearApplicable: true },
      ),
    ).toBe("preparing");
    expect(
      readinessFromRules(
        [
          { label: "A", status: "not_met", type: "required" },
          { label: "B", status: "not_met", type: "required" },
        ],
        6,
        { preselectionNear: true, preselectionNearApplicable: true },
      ),
    ).toBe("near");
  });

  it("honors explicit readiness from API", () => {
    expect(readinessFromRules([], 6, { readiness: "near" })).toBe("near");
    expect(readinessFromRules([], 100, { readiness: "preparing" })).toBe("preparing");
    expect(readinessFromRules([], 70, { readiness: "late" })).toBe("late");
  });

  it("demotes stale API confirmed when a required rule is only partial", () => {
    expect(
      readinessFromRules(
        [
          { ruleKey: "a", type: "required", status: "met" },
          { ruleKey: "b", type: "required", status: "partial" },
        ],
        70,
        { readiness: "confirmed" },
      ),
    ).toBe("preparing");
  });

  it("marks late when lateEntry flag is set", () => {
    expect(readinessFromRules([], 70, { lateEntry: true })).toBe("late");
    expect(readinessFromRules([], 70, { qualityInvalidated: true })).toBe("late");
  });

  it("does not invent Near from quality bands when gate absent", () => {
    expect(readinessFromRules([], 100)).toBe("confirmed");
    expect(readinessFromRules([], 70)).toBe("preparing");
    expect(readinessFromRules([], 20)).toBe("preparing");
  });
});

describe("tradabilityFromTier", () => {
  it("maps known tiers", () => {
    expect(tradabilityFromTier("excellent")).toBe("good");
    expect(tradabilityFromTier("moderate")).toBe("fair");
    expect(tradabilityFromTier("skip")).toBe("poor");
    expect(tradabilityFromTier(undefined)).toBe("unknown");
  });
});

describe("buildRankComponents", () => {
  it("does not invent historical edge from quality", () => {
    const { rankComponents } = buildRankComponents({
      qualityPct: 82,
      historicalEdge: null,
      readiness: "near",
      moveRemainingPct: 0.5,
      exhaustionRisk: false,
      tradability: "unknown",
      hasMovementProfile: true,
    });
    expect(rankComponents.setupQuality).toBe(82);
    expect(rankComponents.historicalEdge).toBe(0);
  });
});

describe("adaptMarketTickerCard", () => {
  it("returns null when card has no signal", () => {
    const card: TickerCardModel = {
      symbol: "QQQ",
      name: "Invesco QQQ",
      signalCount: 0,
      bestSignal: null,
      topStrategyEval: null,
    };
    expect(adaptMarketTickerCard(card)).toBeNull();
  });

  it("keeps quality and historical edge separate", () => {
    const card: TickerCardModel = {
      symbol: "qqq",
      name: "Invesco QQQ",
      signalCount: 1,
      bestSignal: {
        strategyId: "estrategia-05",
        strategyName: "15m BB Breakout",
        qualityPct: 82,
        direction: "CALL",
      },
      topStrategyEval: {
        strategyId: "estrategia-05",
        qualityPct: 82,
        metCount: 2,
        totalCount: 3,
        metRequired: 2,
        totalRequired: 3,
        direction: "CALL",
        directionConfidence: "medium",
        preselectionNear: true,
        preselectionNearApplicable: true,
        readiness: "near",
        rules: [
          { ruleKey: "bb_expand_15m", status: "met", evidence: "BB width expanding" },
          { ruleKey: "rvol_15m", status: "partial" },
          { ruleKey: "trend_1h", status: "met", evidence: "1h trend bullish" },
        ],
      },
      movementProfile: {
        expectedMfePct: 0.82,
        stretchMoveCapPct: 1.21,
        moveCapRemainingPct: 0.56,
        expectedMaePct: 0.31,
        timeToTargetBars: 3,
        exhaustionRisk: false,
      },
    };

    const row = adaptMarketTickerCard(card, {
      updatedAt: "2026-07-30T14:18:00.000Z",
      tradabilityBySymbol: { QQQ: "strong" },
    });

    expect(row).not.toBeNull();
    expect(row!.symbol).toBe("QQQ");
    expect(row!.direction).toBe("CALL");
    expect(row!.qualityPct).toBe(82);
    expect(row!.historicalEdge).toBeNull();
    expect(row!.readiness).toBe("near");
    expect(row!.tradability).toBe("good");
    expect(row!.moveRemainingPct).toBe(0.56);
    expect(row!.marketLean?.actionable).toBe(false);
    expect(row!.supportingReasons.length).toBeGreaterThan(0);
    expect(row!.supportingReasons.length).toBeLessThanOrEqual(3);
  });

  it("skips empty cards when adapting a list", () => {
    const cards: TickerCardModel[] = [
      {
        symbol: "SPY",
        name: null,
        signalCount: 0,
        bestSignal: null,
        topStrategyEval: null,
      },
      {
        symbol: "IWM",
        name: null,
        signalCount: 1,
        bestSignal: {
          strategyId: "e01",
          strategyName: "E01",
          qualityPct: 100,
          direction: "PUT",
        },
        topStrategyEval: {
          strategyId: "e01",
          qualityPct: 100,
          metCount: 1,
          totalCount: 1,
          metRequired: 1,
          totalRequired: 1,
          rules: [{ ruleKey: "x", status: "met" }],
        },
      },
    ];
    const rows = adaptMarketTickerCards(cards);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.symbol).toBe("IWM");
    expect(rows[0]!.readiness).toBe("confirmed");
  });
});

describe("adaptPremarketBestHit", () => {
  it("adapts partial best-result rows without bestTicker refs", () => {
    const hit: PremarketBestResultRow = {
      symbol: "AAPL",
      qualityPct: 90,
      direction: "CALL",
      strategies: [{ strategyId: "dyn-1", label: "Dyn Screen", qualityPct: 90 }],
    };
    const row = adaptPremarketBestHit(hit, { updatedAt: "2026-07-30T10:00:00.000Z" });
    expect(row.source).toBe("premarket");
    expect(row.strategyId).toBe("dyn-1");
    expect(row.historicalEdge).toBeNull();
    expect(row.confirmationItems).toEqual([]);
    expect(row.tradability).toBe("unknown");
  });

  it("uses movement profile and rule evidence when present", () => {
    const ticker: PremarketTickerHit = {
      symbol: "NVDA",
      qualityPct: 100,
      direction: "CALL",
      rules: [
        { ruleKey: "a", label: "Daily aligned", type: "required", status: "met" },
        { ruleKey: "b", label: "RVOL low", type: "required", status: "not_met" },
      ],
      movementProfile: {
        remainingMfePct: 0.4,
        exhaustionRisk: true,
        expectedMfePct: 1.1,
      },
      dangers: [{ dangerKey: "clear_path", status: "failed", evidence: "Resistance nearby" }],
    };
    const row = adaptPremarketTickerHit(ticker, {
      strategyId: "dyn-2",
      name: "NVDA screen",
    });
    expect(row.exhaustionRisk).toBe(true);
    expect(row.conflictReasons.some((r) => /Exhaustion|Resistance|RVOL/i.test(r))).toBe(true);
    expect(row.readiness).toBe("preparing");
  });
});
