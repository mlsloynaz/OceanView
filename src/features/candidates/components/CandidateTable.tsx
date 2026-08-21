import { cn } from "@/shared/lib/cn";
import type {
  CandidateDirection,
  CandidateReadiness,
  CandidateViewModel,
  TradabilityGrade,
} from "../models/CandidateViewModel";
import { exitAwareReadinessLabel } from "../lib/exitOverlay";
import { directionLabel, readinessLabel, tradabilityLabel } from "../lib/normalize";

function fmtPct(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function fmtEdge(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value)}%`;
}

function fmtUpdated(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${Math.round(sec / 3600)}h`;
}

function directionClass(direction: CandidateDirection): string {
  if (direction === "CALL") return "text-ocean-teal-dim dark:text-ocean-teal";
  if (direction === "PUT") return "text-ocean-danger";
  return "text-ocean-sand";
}

function readinessClass(readiness: CandidateReadiness, exitSuggested?: boolean): string {
  if (exitSuggested) return "text-ocean-danger";
  if (readiness === "confirmed") return "text-ocean-teal-dim dark:text-ocean-teal";
  if (readiness === "near" || readiness === "watching") return "text-amber-800 dark:text-amber-200";
  if (readiness === "late" || readiness === "weakening") return "text-amber-900 dark:text-amber-300";
  if (readiness === "invalid" || readiness === "error") return "text-ocean-danger";
  return "text-ocean-sand";
}

function tradabilityClass(grade: TradabilityGrade): string {
  if (grade === "good") return "text-ocean-teal-dim dark:text-ocean-teal";
  if (grade === "fair") return "text-amber-800 dark:text-amber-200";
  if (grade === "poor") return "text-ocean-danger";
  return "text-ocean-sand/70";
}

function statusLabel(row: CandidateViewModel): string {
  return exitAwareReadinessLabel(row) || readinessLabel(row.readiness);
}

type Props = {
  candidates: CandidateViewModel[];
  selectedId?: string | null;
  onSelect: (candidate: CandidateViewModel) => void;
  emptyMessage?: string;
};

export function CandidateTable({
  candidates,
  selectedId,
  onSelect,
  emptyMessage = "No candidates yet. Run a scan to populate Top Candidates.",
}: Props) {
  if (candidates.length === 0) {
    return <p className="text-sm text-ocean-sand">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-ocean-mid/40">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-ocean-mid/40 bg-ocean-deep/30 text-[11px] uppercase tracking-wide text-ocean-sand/80">
          <tr>
            <th className="px-3 py-2 font-semibold">Symbol</th>
            <th className="px-3 py-2 font-semibold">Direction</th>
            <th className="px-3 py-2 font-semibold">Setup</th>
            <th className="px-3 py-2 font-semibold">Readiness</th>
            <th className="px-3 py-2 font-semibold" title="Strategy setup completeness — not win rate">
              Quality
            </th>
            <th
              className="px-3 py-2 font-semibold"
              title="Historical target-first rate when outcomes exist"
            >
              Hist. edge
            </th>
            <th
              className="px-3 py-2 font-semibold"
              title="Stock room remaining · projected option gain if room is used (vs Tradable 12%)"
            >
              Room / Proj.
            </th>
            <th className="px-3 py-2 font-semibold">Tradability</th>
            <th className="px-3 py-2 font-semibold">Updated</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((row) => {
            const selected = row.id === selectedId;
            return (
              <tr
                key={row.id}
                tabIndex={0}
                aria-selected={selected}
                onClick={() => onSelect(row)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(row);
                  }
                }}
                className={cn(
                  "cursor-pointer border-b border-ocean-mid/30 transition-colors last:border-0",
                  selected ? "bg-ocean-teal/10" : "hover:bg-ocean-deep/25",
                  row.exhaustionRisk ? "outline outline-1 outline-ocean-danger/40" : null,
                  row.exitMonitor?.exitSuggested
                    ? "outline outline-1 outline-ocean-danger/60"
                    : null,
                )}
              >
                <td className="px-3 py-2.5 font-semibold text-ocean-foam">{row.symbol}</td>
                <td className={cn("px-3 py-2.5 font-semibold", directionClass(row.direction))}>
                  {directionLabel(row.direction)}
                </td>
                <td
                  className="max-w-[14rem] px-3 py-2.5 text-ocean-sand"
                  title={[
                    row.strategyName,
                    ...(row.secondaryStrategies ?? []).map(
                      (s) =>
                        `${s.strategyName} (${Math.round(s.qualityPct)}%${
                          s.direction && s.direction !== "neutral" ? ` ${s.direction}` : ""
                        })`,
                    ),
                  ].join(" · ")}
                >
                  <div className="flex flex-col gap-0.5 leading-snug">
                    <span className="truncate text-sm text-ocean-sand">{row.strategyName}</span>
                    {(row.secondaryStrategies ?? []).map((s) => (
                      <span
                        key={s.strategyId}
                        className="truncate text-xs text-ocean-sand/60"
                      >
                        {s.strategyName}
                      </span>
                    ))}
                  </div>
                </td>
                <td
                  className={cn(
                    "px-3 py-2.5 font-medium",
                    readinessClass(row.readiness, row.exitMonitor?.exitSuggested),
                  )}
                >
                  {statusLabel(row)}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-ocean-foam">
                  {Math.round(row.qualityPct)}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-ocean-sand">
                  {fmtEdge(row.historicalEdge)}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-ocean-sand">
                  <span title="Stock room remaining">{fmtPct(row.moveRemainingPct, 2)}</span>
                  <span className="text-ocean-sand/50"> · </span>
                  <span
                    className="text-ocean-foam"
                    title="Projected option earning % if remaining room is fully used"
                  >
                    {row.projectedOptionGainPct == null
                      ? "—"
                      : `~${fmtPct(row.projectedOptionGainPct, 0)}`}
                  </span>
                </td>
                <td className={cn("px-3 py-2.5", tradabilityClass(row.tradability))}>
                  {tradabilityLabel(row.tradability)}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-ocean-sand/80">
                  {fmtUpdated(row.updatedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
