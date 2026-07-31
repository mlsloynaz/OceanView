import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import type { LearningHorizonResult, LearningObservation, LearningOutcome } from "../types";

type Props = {
  open: boolean;
  observation: LearningObservation | null;
  outcome: LearningOutcome | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
};

function fmtPct(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function fmtBool(value: boolean | null | undefined): string {
  if (value == null) return "—";
  return value ? "Yes" : "No";
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-ocean-teal">{title}</h3>
      {children}
    </section>
  );
}

function HorizonCard({ h }: { h: LearningHorizonResult }) {
  return (
    <div className="rounded-lg border border-ocean-mid/40 bg-ocean-deep/20 px-3 py-2">
      <p className="mb-2 text-xs font-semibold text-ocean-foam">
        {h.horizonId ?? `${h.bars ?? "?"}×${h.timeframe ?? "?"}`}
        {h.complete === false ? (
          <span className="ml-2 font-normal text-amber-300/90">incomplete</span>
        ) : null}
      </p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
        <div>
          <dt className="text-ocean-sand/70">MFE</dt>
          <dd className="tabular-nums text-emerald-400">{fmtPct(h.maxFavorableExcursionPct)}</dd>
        </div>
        <div>
          <dt className="text-ocean-sand/70">MAE</dt>
          <dd className="tabular-nums text-rose-400">{fmtPct(h.maxAdverseExcursionPct)}</dd>
        </div>
        <div>
          <dt className="text-ocean-sand/70">Target before stop</dt>
          <dd className="text-ocean-foam">{fmtBool(h.targetBeforeStop)}</dd>
        </div>
        <div>
          <dt className="text-ocean-sand/70">Direction correct</dt>
          <dd className="text-ocean-foam">{fmtBool(h.directionCorrect)}</dd>
        </div>
        <div>
          <dt className="text-ocean-sand/70">Bars to target</dt>
          <dd className="tabular-nums text-ocean-foam">{h.barsToTarget ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-ocean-sand/70">Bars available</dt>
          <dd className="tabular-nums text-ocean-foam">
            {h.barsAvailable ?? "—"}/{h.bars ?? "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function ObservationDetailDrawer({
  open,
  observation,
  outcome,
  loading,
  error,
  onClose,
}: Props) {
  if (!open || !observation) return null;

  const rules = Array.isArray(observation.ruleResults) ? observation.ruleResults : [];

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close observation detail"
        onClick={onClose}
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-ocean-mid/50 bg-ocean-surface shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-ocean-mid/40 px-4 py-3">
          <div className="min-w-0">
            <p className="font-display text-xl font-semibold text-ocean-foam">
              {observation.symbol} — {observation.direction ?? "—"}
            </p>
            <p className="mt-0.5 truncate text-sm text-ocean-sand">
              {observation.strategyId ?? "strategy?"} · {observation.outcomeStatus ?? "—"}
            </p>
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
          <Section title="Prediction (immutable)">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
              <div>
                <dt className="text-ocean-sand/70">Quality</dt>
                <dd className="font-medium text-ocean-foam">
                  {observation.qualityPct != null ? `${Math.round(observation.qualityPct)}%` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-ocean-sand/70">Observed</dt>
                <dd className="font-medium text-ocean-foam">{observation.observedAt}</dd>
              </div>
              <div>
                <dt className="text-ocean-sand/70">Source</dt>
                <dd className="font-medium text-ocean-foam">{observation.source ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ocean-sand/70">Trade date</dt>
                <dd className="font-medium text-ocean-foam">{observation.tradeDate ?? "—"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-ocean-sand/70">Observation id</dt>
                <dd className="break-all font-mono text-[11px] text-ocean-foam/80">
                  {observation.observationId}
                </dd>
              </div>
            </dl>
          </Section>

          <Section title="Rules at capture">
            {!rules.length ? (
              <p className="text-xs text-ocean-sand">No rule snapshot.</p>
            ) : (
              <ul className="space-y-1">
                {rules.map((raw, i) => {
                  const row = (raw ?? {}) as {
                    ruleKey?: string;
                    status?: string;
                    label?: string;
                  };
                  return (
                    <li
                      key={`${row.ruleKey ?? i}`}
                      className="flex flex-wrap items-center justify-between gap-2 text-[11px]"
                    >
                      <span className="text-ocean-foam/90">{row.label ?? row.ruleKey ?? `rule-${i}`}</span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 font-medium capitalize",
                          row.status === "met"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : row.status === "partial"
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-ocean-mid/40 text-ocean-sand",
                        )}
                      >
                        {row.status ?? "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title="Outcome">
            {loading ? (
              <p className="text-xs text-ocean-sand">Loading outcome…</p>
            ) : error ? (
              <p className="text-xs text-rose-400">{error}</p>
            ) : observation.outcomeStatus !== "complete" || !outcome ? (
              <p className="text-xs text-ocean-sand">
                No outcome yet — still pending or skipped. Run the worker after enough bars
                exist.
              </p>
            ) : (
              <div className="space-y-3">
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <div>
                    <dt className="text-ocean-sand/70">Primary MFE</dt>
                    <dd className="font-medium tabular-nums text-emerald-400">
                      {fmtPct(outcome.maxFavorableExcursionPct)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ocean-sand/70">Primary MAE</dt>
                    <dd className="font-medium tabular-nums text-rose-400">
                      {fmtPct(outcome.maxAdverseExcursionPct)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ocean-sand/70">Target before stop</dt>
                    <dd className="font-medium text-ocean-foam">
                      {fmtBool(outcome.targetBeforeStop)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ocean-sand/70">Direction correct</dt>
                    <dd className="font-medium text-ocean-foam">
                      {fmtBool(outcome.directionCorrect)}
                    </dd>
                  </div>
                </dl>
                <div className="space-y-2">
                  {(outcome.horizons ?? []).map((h) => (
                    <HorizonCard key={h.horizonId ?? `${h.bars}-${h.timeframe}`} h={h} />
                  ))}
                </div>
              </div>
            )}
          </Section>
        </div>
      </aside>
    </div>
  );
}
