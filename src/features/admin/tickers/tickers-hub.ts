/** Nested views under Admin → Tickers. */

export type TickersHubView = "hub" | "watchlist" | "best-fit" | "tradable";

export type TickersHubMeta = {
  id: Exclude<TickersHubView, "hub">;
  anchorId: string;
  title: string;
  description: string;
};

export const TICKERS_HUB_ORDER: Array<Exclude<TickersHubView, "hub">> = [
  "watchlist",
  "best-fit",
  "tradable",
];

export const TICKERS_HUB: Record<Exclude<TickersHubView, "hub">, TickersHubMeta> = {
  watchlist: {
    id: "watchlist",
    anchorId: "admin-tickers-watchlist",
    title: "Watchlist",
    description: "Catalog list — search, activate/deactivate, add symbols, movement profiles",
  },
  "best-fit": {
    id: "best-fit",
    anchorId: "admin-tickers-best-fit",
    title: "Best-fit",
    description: "Long-term stock fitness from movement profiles — all scored, best on top",
  },
  tradable: {
    id: "tradable",
    anchorId: "admin-tickers-tradable",
    title: "Tradable",
    description: "Option bid–ask for the full catalog — Ready + freshness, promote with checkboxes",
  },
};

export const TICKERS_HUB_ROOT_ANCHOR = "admin-tickers-pane";

export function tickersHubViewFromHash(hash: string): TickersHubView {
  const id = hash.replace(/^#/, "");
  if (!id || id === TICKERS_HUB_ROOT_ANCHOR) return "hub";
  const match = TICKERS_HUB_ORDER.find((view) => TICKERS_HUB[view].anchorId === id);
  return match ?? "hub";
}

export function hashForTickersHubView(view: TickersHubView): string {
  if (view === "hub") return `#${TICKERS_HUB_ROOT_ANCHOR}`;
  return `#${TICKERS_HUB[view].anchorId}`;
}
