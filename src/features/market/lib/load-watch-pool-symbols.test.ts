import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/features/admin/setup-scan/api/preselection-client", () => ({
  getSetupScanResult: vi.fn(),
}));

import { getSetupScanResult } from "@/features/admin/setup-scan/api/preselection-client";
import { loadMarketWatchPoolSymbols } from "./load-watch-pool-symbols";

const mockedGet = vi.mocked(getSetupScanResult);

describe("loadMarketWatchPoolSymbols", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("prefers open watchPool.symbols", async () => {
    mockedGet.mockResolvedValueOnce({
      runId: "o1",
      status: "complete",
      watchPool: { symbols: ["amzn", "DASH"] },
      strategies: [],
    });
    await expect(loadMarketWatchPoolSymbols()).resolves.toEqual(["AMZN", "DASH"]);
    expect(mockedGet).toHaveBeenCalledWith(undefined, "open");
  });

  it("falls back to eod strategy tickers when open empty", async () => {
    mockedGet
      .mockResolvedValueOnce({
        runId: "o1",
        status: "complete",
        strategies: [],
      })
      .mockResolvedValueOnce({
        runId: "e1",
        status: "complete",
        strategies: [
          {
            strategyId: "estrategia-04",
            name: "E04",
            tickerCount: 1,
            tickers: [
              {
                symbol: "DIA",
                currentlyActive: true,
                ready: true,
                score: 5,
                maxScore: 5,
                tier: "strong",
                reasons: [],
                avoidReasons: [],
                breakdown: [],
                requiredPassed: true,
              },
            ],
          },
        ],
      });
    await expect(loadMarketWatchPoolSymbols()).resolves.toEqual(["DIA"]);
  });

  it("returns empty when both modes have no pool", async () => {
    mockedGet.mockRejectedValue(new Error("missing"));
    await expect(loadMarketWatchPoolSymbols()).resolves.toEqual([]);
  });
});
