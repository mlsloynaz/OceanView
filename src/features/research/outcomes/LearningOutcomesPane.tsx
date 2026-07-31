import { AdminExpandedPane } from "@/features/admin/components/AdminExpandedPane";
import { cn } from "@/shared/lib/cn";
import { ObservationDetailDrawer } from "./components/ObservationDetailDrawer";
import { useLearningOutcomes, type OutcomeFilter } from "./hooks/useLearningOutcomes";
import type { LearningObservation } from "./types";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const BTN_PRIMARY = cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-105");
const BTN_SECONDARY = cn(
  BTN,
  "border-2 border-ocean-teal bg-ocean-deep text-ocean-foam hover:bg-ocean-teal/10",
);

const FILTERS: { id: OutcomeFilter; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "complete", label: "Complete" },
  { id: "skipped", label: "Skipped" },
];

type Props = {
  onBack?: () => void;
};

function statusTone(status: string | undefined) {
  if (status === "complete") return "text-emerald-400";
  if (status === "skipped") return "text-ocean-sand";
  if (status === "running" || status === "queued") return "text-amber-300";
  return "text-ocean-foam";
}

function ObservationRow({
  row,
  selected,
  onSelect,
}: {
  row: LearningObservation;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <tr
      className={cn(
        "cursor-pointer border-b border-ocean-mid/30 transition-colors hover:bg-ocean-deep/30",
        selected && "bg-ocean-teal/10",
      )}
      onClick={onSelect}
    >
      <td className="px-2 py-2 font-semibold text-ocean-foam">{row.symbol}</td>
      <td className="px-2 py-2 text-ocean-sand">{row.direction ?? "—"}</td>
      <td className="px-2 py-2 text-ocean-sand">{row.strategyId ?? "—"}</td>
      <td className="px-2 py-2 tabular-nums text-ocean-foam">
        {row.qualityPct != null ? `${Math.round(row.qualityPct)}%` : "—"}
      </td>
      <td className="px-2 py-2 text-ocean-sand">{row.observedAt}</td>
      <td className={cn("px-2 py-2 capitalize", statusTone(row.outcomeStatus))}>
        {row.outcomeStatus ?? "—"}
      </td>
    </tr>
  );
}

export function LearningOutcomesPane({ onBack }: Props) {
  const ws = useLearningOutcomes();

  return (
    <>
      <AdminExpandedPane
        id="research-outcomes-pane"
        title={
          onBack ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className="rounded border border-ocean-mid/50 px-2 py-0.5 text-xs font-medium text-ocean-sand hover:border-ocean-teal/50 hover:text-ocean-foam"
              >
                ← Research
              </button>
              <span>Outcomes</span>
            </span>
          ) : (
            "Outcomes"
          )
        }
        subtitle="Learning observations vs measured horizons — quality is not historical edge"
        headerExtra={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={BTN_SECONDARY}
              disabled={ws.loading || ws.running}
              onClick={() => void ws.refresh()}
            >
              Refresh
            </button>
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={ws.loading || ws.running}
              onClick={() => void ws.runNow(false)}
            >
              {ws.running ? "Running…" : "Run outcomes now"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-xs text-ocean-sand">
            {ws.usesMock ? (
              <span className="rounded bg-amber-500/15 px-2 py-0.5 text-amber-300">Mock data</span>
            ) : ws.apiBase ? (
              <span className="truncate font-mono text-[10px] text-ocean-sand/70">{ws.apiBase}</span>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-3 py-2">
              <p className="text-[11px] text-ocean-sand">Pending</p>
              <p className="font-display text-2xl font-semibold tabular-nums text-ocean-foam">
                {ws.pendingCount}
              </p>
            </div>
            <div className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-3 py-2">
              <p className="text-[11px] text-ocean-sand">Complete</p>
              <p className="font-display text-2xl font-semibold tabular-nums text-emerald-400">
                {ws.completeCount}
              </p>
            </div>
            <div className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-3 py-2">
              <p className="text-[11px] text-ocean-sand">Worker (learning_outcomes)</p>
              <p className={cn("font-display text-lg font-semibold capitalize", statusTone(ws.job?.status))}>
                {ws.job?.status ?? "idle"}
              </p>
              {ws.job?.summary ? (
                <p className="mt-1 text-[10px] text-ocean-sand/80">
                  last: completed {ws.job.summary.completed ?? 0} / scanned{" "}
                  {ws.job.summary.scanned ?? 0}
                </p>
              ) : null}
            </div>
          </div>

          {ws.runMessage ? (
            <p className="rounded-md border border-ocean-teal/30 bg-ocean-teal/10 px-3 py-2 text-xs text-ocean-foam">
              {ws.runMessage}
            </p>
          ) : null}
          {ws.error ? (
            <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {ws.error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={cn(
                  BTN,
                  ws.filter === f.id
                    ? "bg-ocean-teal text-ocean-deep"
                    : "border border-ocean-mid/50 text-ocean-sand hover:border-ocean-teal/40",
                )}
                onClick={() => ws.setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {ws.loading ? (
            <p className="text-sm text-ocean-sand">Loading observations…</p>
          ) : !ws.observations.length ? (
            <p className="text-sm text-ocean-sand">
              No {ws.filter} observations. Capture runs when Market/Premarket assess finds E05
              candidates in the learning universe.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-ocean-mid/40">
              <table className="w-full min-w-[40rem] text-left text-xs">
                <thead className="border-b border-ocean-mid/40 bg-ocean-deep/40 text-[10px] uppercase tracking-wide text-ocean-sand">
                  <tr>
                    <th className="px-2 py-2 font-medium">Symbol</th>
                    <th className="px-2 py-2 font-medium">Dir</th>
                    <th className="px-2 py-2 font-medium">Strategy</th>
                    <th className="px-2 py-2 font-medium">Quality</th>
                    <th className="px-2 py-2 font-medium">Observed</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ws.observations.map((row) => (
                    <ObservationRow
                      key={row.observationId}
                      row={row}
                      selected={ws.selectedId === row.observationId}
                      onSelect={() => void ws.openDetail(row)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AdminExpandedPane>

      <ObservationDetailDrawer
        open={Boolean(ws.selectedId)}
        observation={ws.selectedObs}
        outcome={ws.selectedOutcome}
        loading={ws.detailLoading}
        error={ws.detailError}
        onClose={ws.closeDetail}
      />
    </>
  );
}
