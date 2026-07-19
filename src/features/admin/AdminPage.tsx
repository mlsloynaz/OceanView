import { useCallback, useEffect, useState } from "react";
import { ADMIN_PANE_ORDER, ADMIN_PANES, adminPaneFromHash, type AdminPaneId } from "./admin-panes";
import { CandlesPane } from "./candles/CandlesPane";
import { ADMIN_PANE_ICONS, AdminPaneThumbnail } from "./components/AdminPaneThumbnail";
import { JobsStatusPane } from "./job-status/JobsStatusPane";
import { ResearchStatsPane } from "./research-stats/ResearchStatsPane";
import { SetupScanPane } from "./setup-scan/SetupScanPane";
import { StrategiesPane } from "./strategies/StrategiesPane";
import { TickersPane } from "./tickers/TickersPane";

function renderActivePane(id: AdminPaneId) {
  switch (id) {
    case "setup-scan":
      return <SetupScanPane />;
    case "tickers":
      return <TickersPane />;
    case "candles":
      return <CandlesPane />;
    case "strategies":
      return <StrategiesPane />;
    case "research-stats":
      return <ResearchStatsPane />;
    case "job-status":
      return <JobsStatusPane />;
  }
}

export function AdminPage() {
  const [activePane, setActivePane] = useState<AdminPaneId | null>(() =>
    adminPaneFromHash(window.location.hash),
  );

  useEffect(() => {
    const syncFromHash = () => {
      setActivePane(adminPaneFromHash(window.location.hash));
    };
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const selectPane = useCallback((id: AdminPaneId) => {
    setActivePane((current) => {
      const next = current === id ? null : id;
      const hash = next ? `#${ADMIN_PANES[next].anchorId}` : "";
      window.history.replaceState(null, "", `${window.location.pathname}${hash}`);
      return next;
    });
  }, []);

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ocean-foam sm:text-4xl">Admin</h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-ocean-sand">
          Configuration for tickers, candles, strategies, and job status. Choose a pane
          below —{" "}
          <button
            type="button"
            className="text-ocean-teal hover:underline"
            onClick={() => selectPane("setup-scan")}
          >
            Tickers SemiFinal
          </button>{" "}
          (preselection) ranks the full catalog — activate tickers from there before live evaluate.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
        {ADMIN_PANE_ORDER.map((id) => {
          const meta = ADMIN_PANES[id];
          return (
            <AdminPaneThumbnail
              key={id}
              title={meta.title}
              description={meta.description}
              icon={ADMIN_PANE_ICONS[id]}
              active={activePane === id}
              onClick={() => selectPane(id)}
            />
          );
        })}
      </div>

      {activePane ? renderActivePane(activePane) : null}
    </div>
  );
}
