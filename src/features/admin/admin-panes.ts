export type AdminPaneId = "setup-scan" | "tickers" | "candles" | "strategies";

export type AdminPaneMeta = {
  id: AdminPaneId;
  anchorId: string;
  title: string;
  description: string;
};

export const ADMIN_PANE_ORDER: AdminPaneId[] = [
  "setup-scan",
  "tickers",
  "candles",
  "strategies",
];

export const ADMIN_PANES: Record<AdminPaneId, AdminPaneMeta> = {
  "setup-scan": {
    id: "setup-scan",
    anchorId: "admin-setup-scan-pane",
    title: "Tickers SemiFinal",
    description: "D+1h preselection — refresh stale candles and score the catalog",
  },
  tickers: {
    id: "tickers",
    anchorId: "admin-tickers-pane",
    title: "Tickers",
    description: "Search, filter, Active and Operation flags for Market and Candles",
  },
  candles: {
    id: "candles",
    anchorId: "admin-candles-pane",
    title: "Candles",
    description: "Monitor price data intake and refresh stored bars",
  },
  strategies: {
    id: "strategies",
    anchorId: "admin-strategies-pane",
    title: "Strategies",
    description: "Activate standard playbooks and manage dynamic screens",
  },
};

export function adminPaneFromHash(hash: string): AdminPaneId | null {
  const id = hash.replace(/^#/, "");
  return ADMIN_PANE_ORDER.find((paneId) => ADMIN_PANES[paneId].anchorId === id) ?? null;
}
