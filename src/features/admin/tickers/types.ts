export type CatalogTicker = {
  symbol: string;
  name: string | null;
  isFavorite: boolean;
  active: boolean;
};

export type CatalogTickersResponse = {
  tickers: CatalogTicker[];
};

export type TickerCatalogFilter = "all" | "active" | "inactive";

export type TickerMovementProfileEntry = {
  symbol: string;
  outcome: string;
  message?: string | null;
  updatedAt?: string | null;
  historyBars?: number | null;
  profile: import("@/features/premarket/types").MovementProfile | null;
};