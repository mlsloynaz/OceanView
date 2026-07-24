export type AdminPaneId =
  | "setup-scan"
  | "tickers"
  | "candles"
  | "strategies"
  | "lab"
  | "job-status";

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
  "lab",
  "job-status",
];

export const ADMIN_PANES: Record<AdminPaneId, AdminPaneMeta> = {
  "setup-scan": {
    id: "setup-scan",
    anchorId: "admin-setup-scan-pane",
    title: "Tickers SemiFinal",
    description: "D+1h preselection — E05 Inside BB 15M + E04 Lateral BB15 (15m EOD lateral)",
  },
  tickers: {
    id: "tickers",
    anchorId: "admin-tickers-pane",
    title: "Tickers",
    description: "Watchlist, best-fit ranking, and option tradability sampling",
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
  lab: {
    id: "lab",
    anchorId: "admin-lab-pane",
    title: "Lab",
    description: "Research-Stats and custom studies (Lab1 ETF Bollinger, …)",
  },
  "job-status": {
    id: "job-status",
    anchorId: "admin-job-status-pane",
    title: "Job Status",
    description: "Latest run status for candles, market, premarket, and preselection jobs",
  },
};

export function adminPaneFromHash(hash: string): AdminPaneId | null {
  const id = hash.replace(/^#/, "");
  if (id.startsWith("admin-tickers")) return "tickers";
  if (id.startsWith("admin-lab")) return "lab";
  // Legacy Research-Stats hash → Lab hub
  if (id === "admin-research-stats-pane") return "lab";
  return ADMIN_PANE_ORDER.find((paneId) => ADMIN_PANES[paneId].anchorId === id) ?? null;
}
