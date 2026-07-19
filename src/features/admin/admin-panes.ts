export type AdminPaneId =
  | "setup-scan"
  | "tickers"
  | "candles"
  | "strategies"
  | "research-stats"
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
  "research-stats",
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
    description: "Search, filter, and activate symbols for Market and Candles",
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
  "research-stats": {
    id: "research-stats",
    anchorId: "admin-research-stats-pane",
    title: "Research-Stats",
    description: "Historical rule/strategy hit rates by hour — free ticker + date range",
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
  return ADMIN_PANE_ORDER.find((paneId) => ADMIN_PANES[paneId].anchorId === id) ?? null;
}
