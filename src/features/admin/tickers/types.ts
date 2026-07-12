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
