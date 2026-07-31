import { TodaySection } from "./TodaySection";

type Props = {
  selectedSymbol: string | null;
};

export function CandidateDetailSection({ selectedSymbol }: Props) {
  return (
    <TodaySection
      id="today-candidate-detail"
      title="Candidate Detail"
      subtitle="Unified drawer comes in the next phase — open a ticker card for the existing detail modal"
    >
      {selectedSymbol ? (
        <p className="text-sm text-ocean-sand">
          Selected:{" "}
          <span className="font-semibold text-ocean-foam">{selectedSymbol}</span> — detail opens in
          the existing modal until the CandidateViewModel drawer lands.
        </p>
      ) : (
        <p className="text-sm text-ocean-sand">
          Select a candidate from Top Candidates to inspect quality, rules, and confirmation. Why /
          Conflicts / Movement / Trade plan will live here later.
        </p>
      )}
    </TodaySection>
  );
}
