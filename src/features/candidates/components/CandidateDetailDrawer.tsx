import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import type { CandidateViewModel } from "../models/CandidateViewModel";
import { directionLabel, readinessLabel, tradabilityLabel } from "../lib/normalize";

type Props = {
  candidate: CandidateViewModel | null;
  open: boolean;
  onClose: () => void;
};

function fmtPct(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-ocean-teal">{title}</h3>
      {children}
    </section>
  );
}

export function CandidateDetailDrawer({ candidate, open, onClose }: Props) {
  if (!open || !candidate) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close candidate detail"
        onClick={onClose}
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-ocean-mid/50 bg-ocean-surface shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-ocean-mid/40 px-4 py-3">
          <div className="min-w-0">
            <p className="font-display text-xl font-semibold text-ocean-foam">
              {candidate.symbol} — {directionLabel(candidate.direction)}
            </p>
            <p className="mt-0.5 text-sm text-ocean-sand">{candidate.strategyName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-ocean-mid/50 px-2 py-1 text-xs font-semibold text-ocean-sand hover:bg-ocean-mid/40"
          >
            Close
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 text-sm">
          <Section title="Summary">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
              <div>
                <dt className="text-ocean-sand/70">Status</dt>
                <dd className="font-medium text-ocean-foam">{readinessLabel(candidate.readiness)}</dd>
              </div>
              <div>
                <dt className="text-ocean-sand/70">Setup quality</dt>
                <dd className="font-medium text-ocean-foam">{Math.round(candidate.qualityPct)}%</dd>
              </div>
              <div>
                <dt className="text-ocean-sand/70">Historical edge</dt>
                <dd className="font-medium text-ocean-foam">
                  {candidate.historicalEdge == null
                    ? "—"
                    : `${Math.round(candidate.historicalEdge)}%`}
                </dd>
              </div>
              <div>
                <dt className="text-ocean-sand/70">Confidence</dt>
                <dd className="font-medium capitalize text-ocean-foam">
                  {candidate.confidence ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-ocean-sand/70">Option tradability</dt>
                <dd className="font-medium text-ocean-foam">
                  {tradabilityLabel(candidate.tradability)}
                </dd>
              </div>
              <div>
                <dt className="text-ocean-sand/70">Rank (order only)</dt>
                <dd className="font-medium text-ocean-foam">{candidate.rankScore}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-ocean-sand/70">
              Quality is setup completeness. Historical edge is outcome probability when labeled
              data exists — never the same number.
            </p>
          </Section>

          {candidate.marketLean ? (
            <Section title="Market Lean">
              <p className="text-ocean-foam">
                {directionLabel(candidate.marketLean.direction)}
                {candidate.marketLean.confidence
                  ? ` · ${candidate.marketLean.confidence} confidence`
                  : ""}
              </p>
              <p className="text-xs text-ocean-sand">
                Informational — confirmation still required. Not an entry signal.
              </p>
            </Section>
          ) : null}

          <Section title="Why">
            {candidate.supportingReasons.length === 0 ? (
              <p className="text-ocean-sand">No supporting rule evidence yet.</p>
            ) : (
              <ul className="space-y-1">
                {candidate.supportingReasons.map((reason) => (
                  <li key={reason} className="flex gap-2 text-ocean-foam">
                    <span className="text-ocean-teal">✓</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Conflicts">
            {candidate.conflictReasons.length === 0 ? (
              <p className="text-ocean-sand">No major conflicts flagged.</p>
            ) : (
              <ul className="space-y-1">
                {candidate.conflictReasons.map((reason) => (
                  <li key={reason} className="flex gap-2 text-ocean-sand">
                    <span className="text-amber-500">!</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Movement">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-ocean-sand">
              <div>
                <dt className="text-ocean-sand/70">Expected move</dt>
                <dd className="text-ocean-foam">{fmtPct(candidate.expectedMovePct)}</dd>
              </div>
              <div>
                <dt className="text-ocean-sand/70">Stretch move</dt>
                <dd className="text-ocean-foam">{fmtPct(candidate.stretchMovePct)}</dd>
              </div>
              <div>
                <dt className="text-ocean-sand/70">Room remaining</dt>
                <dd className="text-ocean-foam">{fmtPct(candidate.moveRemainingPct)}</dd>
              </div>
              <div>
                <dt className="text-ocean-sand/70">Typical adverse (MAE)</dt>
                <dd className="text-ocean-foam">{fmtPct(candidate.expectedMaePct)}</dd>
              </div>
              <div>
                <dt className="text-ocean-sand/70">P75 / P90 MAE</dt>
                <dd className="text-ocean-foam">
                  {fmtPct(candidate.movementProfile?.p75MaePct) === "—" &&
                  fmtPct(candidate.movementProfile?.p90MaePct) === "—"
                    ? "—"
                    : `${fmtPct(candidate.movementProfile?.p75MaePct)} / ${fmtPct(candidate.movementProfile?.p90MaePct)}`}
                </dd>
              </div>
              <div>
                <dt className="text-ocean-sand/70">P75 / P90 MFE</dt>
                <dd className="text-ocean-foam">
                  {fmtPct(candidate.movementProfile?.p75MfePct) === "—" &&
                  fmtPct(candidate.movementProfile?.p90MfePct) === "—"
                    ? "—"
                    : `${fmtPct(candidate.movementProfile?.p75MfePct)} / ${fmtPct(candidate.movementProfile?.p90MfePct)}`}
                </dd>
              </div>
              <div>
                <dt className="text-ocean-sand/70">Median bars to target</dt>
                <dd className="text-ocean-foam">
                  {candidate.timeToTargetBars == null ? "—" : candidate.timeToTargetBars}
                </dd>
              </div>
              <div>
                <dt className="text-ocean-sand/70">Exhaustion risk</dt>
                <dd
                  className={cn(
                    "font-medium",
                    candidate.exhaustionRisk ? "text-ocean-danger" : "text-ocean-foam",
                  )}
                >
                  {candidate.exhaustionRisk ? "Elevated" : "Low"}
                </dd>
              </div>
            </dl>
          </Section>

          <Section title="Confirmation">
            {candidate.confirmationItems.length === 0 ? (
              <p className="text-ocean-sand">No rule checklist on this row.</p>
            ) : (
              <ul className="space-y-1.5">
                {candidate.confirmationItems.map((item) => (
                  <li key={`${item.label}-${item.status}`} className="flex gap-2">
                    <span className="w-4 shrink-0 text-center text-ocean-sand">
                      {item.status === "met" ? "✓" : item.status === "near" ? "◐" : "○"}
                    </span>
                    <span className="text-ocean-foam">{item.label}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-ocean-sand/70">
              Start Watch remains on Active Watches below — this drawer prepares the view only.
            </p>
          </Section>

          <Section title="Trade plan">
            <p className="text-ocean-sand">
              Plan export to OceanDesk lands in a later phase. Do not treat this as a Buy action.
            </p>
            <button
              type="button"
              disabled
              className="mt-2 rounded-md border border-ocean-mid/50 px-3 py-1.5 text-xs font-semibold text-ocean-sand/50"
              title="OceanDesk plan contract not wired yet"
            >
              Send Plan to OceanDesk
            </button>
          </Section>

          <details className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-ocean-sand">
              Advanced rank components
            </summary>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-ocean-sand">
              {Object.entries(candidate.rankComponents).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-ocean-sand/70">{key}</dt>
                  <dd className="tabular-nums text-ocean-foam">{value}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      </aside>
    </div>
  );
}
