export type LabHubView = "hub" | "research" | "lab1" | "e05Saliendo" | "orbBreakout";

export type LabHubMeta = {
  id: Exclude<LabHubView, "hub">;
  anchorId: string;
  title: string;
  description: string;
};

export const LAB_HUB_ORDER: Array<Exclude<LabHubView, "hub">> = [
  "research",
  "lab1",
  "e05Saliendo",
  "orbBreakout",
];

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
  e05Saliendo: {
    id: "e05Saliendo",
    anchorId: "admin-lab-e05-saliendo",
    title: "E05 saliendo research",
    description:
      "15m open-inside + vol + mid bias + saliendo — time-of-day, bias hold, outside BB, breakout lift",
  },
  orbBreakout: {
    id: "orbBreakout",
    anchorId: "admin-lab-orb-breakout",
    title: "ORB breakout research",
    description:
      "Opening range entry_ready hit rate + follow-through (Alpaca bars) — 09:45–11:30 ET",
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
