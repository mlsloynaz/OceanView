import type { CandidateViewModel } from "@/features/candidates";
import { directionLabel, exitAwareReadinessLabel, readinessLabel } from "@/features/candidates";
import { TodaySection } from "./TodaySection";

type Props = {
  candidate: CandidateViewModel | null;
};

export function CandidateDetailSection({ candidate }: Props) {
  const status =
    candidate != null
      ? exitAwareReadinessLabel(candidate) || readinessLabel(candidate.readiness)
      : null;

  return (
    <TodaySection
      id="today-candidate-detail"
      title="Candidate Detail"
      subtitle="Summary strip — full drawer opens from the Top Candidates table"
    >
      {candidate ? (
        <div className="space-y-1 text-sm text-ocean-sand">
          <p>
            <span className="font-semibold text-ocean-foam">{candidate.symbol}</span>
            {" — "}
            {directionLabel(candidate.direction)} · {candidate.strategyName}
          </p>
          <p>
            {status} · Setup quality {Math.round(candidate.qualityPct)}% · Historical edge{" "}
            {candidate.historicalEdge == null ? "—" : `${Math.round(candidate.historicalEdge)}%`}
          </p>
        </div>
      ) : (
        <p className="text-sm text-ocean-sand">
          Select a candidate from Top Candidates to inspect quality, conflicts, movement, and
          confirmation. The detail drawer keeps advanced fields out of the table.
        </p>
      )}
    </TodaySection>
  );
}
