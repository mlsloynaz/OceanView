import { AdminExpandedPane } from "@/features/admin/components/AdminExpandedPane";
import { cn } from "@/shared/lib/cn";
import { jobsStatusApiBaseUrl, jobsStatusApiUsesMock } from "./api/jobs-status-client";
import { JobStatusCard } from "./JobStatusCard";
import { useJobsStatusPane } from "./hooks/useJobsStatusPane";

const TOOLBAR_BTN =
  "rounded px-2 py-1 text-xs font-medium disabled:opacity-50 transition-colors";

export function JobsStatusPane() {
  const usesMock = jobsStatusApiUsesMock();
  const apiBase = jobsStatusApiBaseUrl();
  const { cards, loading, error, reload } = useJobsStatusPane(true);

  return (
    <AdminExpandedPane
      id="admin-job-status-pane"
      title="Job Status"
      subtitle={
        usesMock
          ? "Mock data (VITE_USE_MOCK_JOBS_STATUS=true)"
          : `Latest job messages — scheduled candle refresh at 5 PM ET${apiBase ? ` · ${apiBase}` : ""}`
      }
      headerExtra={
        <button
          type="button"
          className={cn(
            TOOLBAR_BTN,
            "border border-ocean-mid/60 bg-ocean-deep text-ocean-foam hover:border-ocean-teal/50",
          )}
          disabled={loading}
          onClick={() => void reload()}
        >
          {loading ? "Loading…" : "Reload"}
        </button>
      }
    >
      {usesMock && (
        <p className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-100">
          Mock job status is enabled. Unset VITE_USE_MOCK_JOBS_STATUS for live GET /jobs/status.
        </p>
      )}

      {error ? (
        <p className="mb-3 text-ocean-danger" role="alert">
          {error}
        </p>
      ) : null}

      {loading && cards.length === 0 ? (
        <p className="text-ocean-sand">Loading job status…</p>
      ) : null}

      {!loading && !error && cards.length === 0 ? (
        <p className="text-ocean-sand">No job status records yet.</p>
      ) : null}

      {cards.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((card) => (
            <JobStatusCard key={card.jobType} card={card} />
          ))}
        </div>
      ) : null}
    </AdminExpandedPane>
  );
}
