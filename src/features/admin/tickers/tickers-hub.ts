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
    description:
      "Long-term stock fitness — Movement profiles, ORB 5m, and 5m/15m trend-change angle profiles",
  },
  tradable: {
    id: "tradable",
    anchorId: "admin-tickers-tradable",
    title: "Tradable",
    description:
      "Option bid–ask for the full catalog — search, Ready + freshness, promote with checkboxes",
  },
};

export const TICKERS_HUB_ROOT_ANCHOR = "admin-tickers-pane";

export type BestFitSubTab = "movement" | "orb-5m" | "trend-change-5m" | "trend-change-15m";

export const BEST_FIT_ORB5M_ANCHOR = "admin-tickers-best-fit-orb-5m";
export const BEST_FIT_TREND_CHANGE_5M_ANCHOR = "admin-tickers-best-fit-trend-change-5m";
export const BEST_FIT_TREND_CHANGE_15M_ANCHOR = "admin-tickers-best-fit-trend-change-15m";

const BEST_FIT_SUBTAB_BY_HASH: Record<string, BestFitSubTab> = {
  [BEST_FIT_ORB5M_ANCHOR]: "orb-5m",
  [BEST_FIT_TREND_CHANGE_5M_ANCHOR]: "trend-change-5m",
  [BEST_FIT_TREND_CHANGE_15M_ANCHOR]: "trend-change-15m",
  [TICKERS_HUB["best-fit"].anchorId]: "movement",
};

export function bestFitSubTabFromHash(hash: string): BestFitSubTab {
  const id = hash.replace(/^#/, "");
  return BEST_FIT_SUBTAB_BY_HASH[id] ?? "movement";
}

export function hashForBestFitSubTab(tab: BestFitSubTab): string {
  if (tab === "orb-5m") return `#${BEST_FIT_ORB5M_ANCHOR}`;
  if (tab === "trend-change-5m") return `#${BEST_FIT_TREND_CHANGE_5M_ANCHOR}`;
  if (tab === "trend-change-15m") return `#${BEST_FIT_TREND_CHANGE_15M_ANCHOR}`;
  return `#${TICKERS_HUB["best-fit"].anchorId}`;
}

export function tickersHubViewFromHash(hash: string): TickersHubView {
  const id = hash.replace(/^#/, "");
  if (!id || id === TICKERS_HUB_ROOT_ANCHOR) return "hub";
  if (
    id === BEST_FIT_ORB5M_ANCHOR ||
    id === BEST_FIT_TREND_CHANGE_5M_ANCHOR ||
    id === BEST_FIT_TREND_CHANGE_15M_ANCHOR
  ) {
    return "best-fit";
  }
  const match = TICKERS_HUB_ORDER.find((view) => TICKERS_HUB[view].anchorId === id);
  return match ?? "hub";
}

export function hashForTickersHubView(view: TickersHubView): string {
  if (view === "hub") return `#${TICKERS_HUB_ROOT_ANCHOR}`;
  return `#${TICKERS_HUB[view].anchorId}`;
}
