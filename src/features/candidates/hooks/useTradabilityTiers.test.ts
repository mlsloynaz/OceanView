import { describe, expect, it } from "vitest";
import { buildTradabilityBySymbol } from "./useTradabilityTiers";
import type { TradableWatchlistResponse } from "@/features/admin/tickers/types";

describe("buildTradabilityBySymbol", () => {
  it("maps watchlist tiers and skipped to skip", () => {
    const payload = {
      watchlist: [
        { symbol: "MSFT", score: 80, tier: "excellent", reasons: [] },
        { symbol: "aapl", score: 50, tier: "moderate", reasons: [] },
      ],
      skipped: [{ symbol: "ZZZ", reason: "No eligible CALL/PUT" }],
    } as TradableWatchlistResponse;

    expect(buildTradabilityBySymbol(payload)).toEqual({
      MSFT: "excellent",
      AAPL: "moderate",
      ZZZ: "skip",
    });
  });

  it("returns empty map when payload missing", () => {
    expect(buildTradabilityBySymbol(null)).toEqual({});
    expect(buildTradabilityBySymbol(undefined)).toEqual({});
  });
});
