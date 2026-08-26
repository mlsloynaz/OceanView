/** Market Assess ticker universe scope. */
export type MarketTickerScope = "allActive" | "watchPool";

export const MARKET_TICKER_SCOPE_LABEL: Record<MarketTickerScope, string> = {
  allActive: "All active",
  watchPool: "Watch pool",
};
