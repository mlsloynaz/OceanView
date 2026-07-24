import { useCallback, useEffect, useState } from "react";
import { AdminPaneThumbnail } from "@/features/admin/components/AdminPaneThumbnail";
import { ResearchStatsPane } from "@/features/admin/research-stats/ResearchStatsPane";
import { Lab1Pane } from "./Lab1Pane";
import {
  hashForLabHubView,
  LAB_HUB,
  LAB_HUB_ORDER,
  labHubViewFromHash,
  type LabHubView,
} from "./lab-hub";

function IconResearch() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M10 2a.75.75 0 01.75.75v.546a6.75 6.75 0 015.954 5.954h.546a.75.75 0 010 1.5h-.546a6.75 6.75 0 01-5.954 5.954v.546a.75.75 0 01-1.5 0v-.546a6.75 6.75 0 01-5.954-5.954H2.75a.75.75 0 010-1.5h.546A6.75 6.75 0 019.25 3.296V2.75A.75.75 0 0110 2zm0 3.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" />
      <path d="M10 8a2 2 0 100 4 2 2 0 000-4z" />
    </svg>
  );
}

function IconLab1() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M6.75 3a.75.75 0 00-.75.75V8.5c0 .834-.278 1.604-.745 2.22L3.72 13.53A.75.75 0 004.25 14.75h11.5a.75.75 0 00.53-1.22l-1.535-2.81A3.75 3.75 0 0114 8.5V3.75a.75.75 0 00-.75-.75h-6.5zM8 4.5h4V8.5a5.24 5.24 0 001.043 3.15l.5.91H6.457l.5-.91A5.24 5.24 0 008 8.5V4.5z" />
      <path d="M7 16.25a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75z" />
    </svg>
  );
}

const HUB_ICONS = {
  research: <IconResearch />,
  lab1: <IconLab1 />,
} as const;

export function LabPane() {
  const [view, setView] = useState<LabHubView>(() => labHubViewFromHash(window.location.hash));

  useEffect(() => {
    const sync = () => setView(labHubViewFromHash(window.location.hash));
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const openView = useCallback((next: LabHubView) => {
    setView(next);
    window.history.replaceState(null, "", `${window.location.pathname}${hashForLabHubView(next)}`);
  }, []);

  if (view === "research") {
    return <ResearchStatsPane onBack={() => openView("hub")} />;
  }
  if (view === "lab1") {
    return <Lab1Pane onBack={() => openView("hub")} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-ocean-foam">Lab</h2>
        <p className="mt-1 max-w-2xl text-sm text-ocean-sand">
          Research tools and custom studies. Open a thumbnail below — Lab1 watches ETF 1m
          Bollinger breakouts; more LabN evaluators land here later.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LAB_HUB_ORDER.map((id) => {
          const meta = LAB_HUB[id];
          return (
            <AdminPaneThumbnail
              key={id}
              title={meta.title}
              description={meta.description}
              icon={HUB_ICONS[id]}
              active={false}
              onClick={() => openView(id)}
            />
          );
        })}
      </div>
    </div>
  );
}
