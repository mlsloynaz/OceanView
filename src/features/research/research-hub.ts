export type ResearchHubView = "hub" | "outcomes" | "research" | "lab1";

export type ResearchHubMeta = {
  id: Exclude<ResearchHubView, "hub">;
  anchorId: string;
  title: string;
  description: string;
};

export const RESEARCH_HUB_ORDER: Array<Exclude<ResearchHubView, "hub">> = [
  "outcomes",
  "research",
  "lab1",
];

export const RESEARCH_HUB: Record<Exclude<ResearchHubView, "hub">, ResearchHubMeta> = {
  outcomes: {
    id: "outcomes",
    anchorId: "research-outcomes-pane",
    title: "Outcomes",
    description:
      "Learning observations vs measured MFE/MAE horizons — run the outcome worker here",
  },
  research: {
    id: "research",
    anchorId: "research-lab-research",
    title: "Research-Stats",
    description: "Historical rule/strategy hit rates by hour — free ticker + date range",
  },
  lab1: {
    id: "lab1",
    anchorId: "research-lab-lab1",
    title: "Lab1 · ETF BB",
    description: "1m Bollinger breakout watch — SPY, DIA, QQQ, SPX, NVDA · Start/Stop every 30s",
  },
};

export const RESEARCH_HUB_ROOT_ANCHOR = "research-hub";

export function researchHubViewFromHash(hash: string): ResearchHubView {
  const id = hash.replace(/^#/, "");
  if (!id || id === RESEARCH_HUB_ROOT_ANCHOR) return "hub";
  // Accept Admin Lab anchors so deep links still open the study panes.
  if (id === "admin-lab-research" || id === "research-lab-research") return "research";
  if (id === "admin-lab-lab1" || id === "research-lab-lab1") return "lab1";
  if (id === "research-outcomes-pane") return "outcomes";
  const match = RESEARCH_HUB_ORDER.find((view) => RESEARCH_HUB[view].anchorId === id);
  return match ?? "hub";
}

export function hashForResearchHubView(view: ResearchHubView): string {
  if (view === "hub") return `#${RESEARCH_HUB_ROOT_ANCHOR}`;
  return `#${RESEARCH_HUB[view].anchorId}`;
}
