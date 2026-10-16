import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CandlesPane } from "@/features/admin/candles/CandlesPane";
import { JobsStatusPane } from "@/features/admin/job-status/JobsStatusPane";
import { ADMIN_PANE_ICONS, AdminPaneThumbnail } from "@/features/admin/components/AdminPaneThumbnail";
import { cn } from "@/shared/lib/cn";

type SystemPaneId = "candles" | "job-status";

const SYSTEM_PANES: Record<
  SystemPaneId,
  { title: string; description: string; anchorId: string }
> = {
  candles: {
    title: "Candles",
    description: "Price data intake, coverage, and bar refresh",
    anchorId: "system-candles-pane",
  },
  "job-status": {
    title: "Job Status",
    description: "Latest run status for candles, market, premarket, and preselection",
    anchorId: "system-job-status-pane",
  },
};

const SYSTEM_PANE_ORDER: SystemPaneId[] = ["candles", "job-status"];

function paneFromHash(hash: string): SystemPaneId | null {
  const id = hash.replace(/^#/, "");
  if (id === "admin-candles-pane" || id === "system-candles-pane") return "candles";
  if (id === "admin-job-status-pane" || id === "system-job-status-pane") return "job-status";
  return SYSTEM_PANE_ORDER.find((paneId) => SYSTEM_PANES[paneId].anchorId === id) ?? null;
}

/**
 * System hub — operational diagnostics out of the Today workflow.
 * Compatibility: /admin#admin-candles-pane, /admin#admin-job-status-pane
 */
export function SystemPage() {
  const [activePane, setActivePane] = useState<SystemPaneId | null>(() =>
    paneFromHash(window.location.hash),
  );

  useEffect(() => {
    const sync = () => setActivePane(paneFromHash(window.location.hash));
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const selectPane = useCallback((id: SystemPaneId) => {
    setActivePane((current) => {
      const next = current === id ? null : id;
      const hash = next ? `#${SYSTEM_PANES[next].anchorId}` : "";
      window.history.replaceState(null, "", `${window.location.pathname}${hash}`);
      return next;
    });
  }, []);

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ocean-foam sm:text-4xl">System</h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-ocean-sand">
          Data freshness, background jobs, and candle coverage. Removes operational noise from Today.
          Full Admin hub remains at{" "}
          <Link to="/admin" className="text-ocean-teal hover:underline">
            /admin
          </Link>
          .
        </p>
      </div>

      <div className={cn("grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4")}>
        {SYSTEM_PANE_ORDER.map((id) => {
          const meta = SYSTEM_PANES[id];
          return (
            <AdminPaneThumbnail
              key={id}
              title={meta.title}
              description={meta.description}
              icon={ADMIN_PANE_ICONS[id === "candles" ? "candles" : "job-status"]}
              active={activePane === id}
              onClick={() => selectPane(id)}
            />
          );
        })}
      </div>

      {activePane === "candles" ? <CandlesPane /> : null}
      {activePane === "job-status" ? <JobsStatusPane /> : null}
    </div>
  );
}
