export type LabHubView = "hub" | "research" | "lab1";

export type LabHubMeta = {
  id: Exclude<LabHubView, "hub">;
  anchorId: string;
  title: string;
  description: string;
};

export const LAB_HUB_ORDER: Array<Exclude<LabHubView, "hub">> = ["research", "lab1"];

export const LAB_HUB: Record<Exclude<LabHubView, "hub">, LabHubMeta> = {
  research: {
    id: "research",
    anchorId: "admin-lab-research",
    title: "Research-Stats",
    description: "Historical rule/strategy hit rates by hour — free ticker + date range",
  },
  lab1: {
    id: "lab1",
    anchorId: "admin-lab-lab1",
    title: "Lab1 · ETF BB",
    description: "1m Bollinger breakout watch — SPY, DIA, QQQ, SPX, NVDA · Start/Stop every 30s",
  },
};

export const LAB_HUB_ROOT_ANCHOR = "admin-lab-pane";

export function labHubViewFromHash(hash: string): LabHubView {
  const id = hash.replace(/^#/, "");
  if (!id || id === LAB_HUB_ROOT_ANCHOR) return "hub";
  const match = LAB_HUB_ORDER.find((view) => LAB_HUB[view].anchorId === id);
  return match ?? "hub";
}

export function hashForLabHubView(view: LabHubView): string {
  if (view === "hub") return `#${LAB_HUB_ROOT_ANCHOR}`;
  return `#${LAB_HUB[view].anchorId}`;
}
