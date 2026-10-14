import { cn } from "@/shared/lib/cn";
import type { BestFitTrendChangeProfileResponse } from "./types";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

function fmtDeg(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}°`;
}

function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function fmtNum(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return String(value);
}

type Variant = "5m" | "15m";

type Props = {
  variant: Variant;
  data: BestFitTrendChangeProfileResponse | null;
  loading: boolean;
  evaluating: boolean;
  error: string | null;
  onEvaluate: () => Promise<void>;
  onReload: () => Promise<void>;
};

const COPY: Record<
  Variant,
  { title: string; blurb: string; study: string; floorLabel: string; schedule: string }
> = {
  "5m": {
    title: "5m trend change",
    blurb:
      "Live Movement alarms store each ring. After the close, the job scores whether the rest of the session moved with the trade (on stored 15m bars). Study field is the trade-side 5m EMA 10 angle at the fire.",
    study: "5m angle",
    floorLabel: "Suggested 5m floor",
    schedule: "Weekdays 5:12 PM ET",
  },
  "15m": {
    title: "15m trend change",
    blurb:
      "Live Movement alarms store each ring. After the close, the job scores whether the rest of the session moved with the trade. Study field is the trade-side 15m angle (1m when 15m was missing).",
    study: "15m angle",
    floorLabel: "Suggested floor",
    schedule: "Weekdays 5:10 PM ET",
  },
};

export function BestFitTrendChangeSection({
  variant,
  data,
  loading,
  evaluating,
  error,
  onEvaluate,
  onReload,
}: Props) {
  const copy = COPY[variant];
  const suggested =
    data?.suggestedMinAngleDeg ??
    (variant === "5m" ? data?.suggestedMinHourAngleDeg : null);
  const buckets = data?.buckets ?? [];
  const via = data?.via ?? [];
  const angle = data?.angle;
  const busy = loading || evaluating;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h3 className="text-sm font-semibold text-ocean-foam">{copy.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-ocean-sand">{copy.blurb}</p>
          <p className="mt-1 text-[11px] text-ocean-sand/80">Score job: {copy.schedule}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onReload()}
            className={cn(BTN, "border border-ocean-mid/50 text-ocean-sand hover:border-ocean-teal/40")}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onEvaluate()}
            className={cn(BTN, "border border-ocean-teal/50 bg-ocean-teal/15 text-ocean-foam")}
          >
            {evaluating ? "Scoring…" : "Score pending now"}
          </button>
        </div>
      </div>

      {error ? <p className="text-xs text-ocean-danger">{error}</p> : null}
      {data?.message ? <p className="text-xs text-ocean-sand/90">{data.message}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sample" value={fmtNum(data?.sampleSize)} />
        <StatCard
          label="Achieved"
          value={
            data?.achievedCount != null
              ? `${data.achievedCount}${data.achievedPct != null ? ` (${fmtPct(data.achievedPct)})` : ""}`
              : "—"
          }
        />
        <StatCard label="Pending" value={fmtNum(data?.pendingCount)} />
        <StatCard label={copy.floorLabel} value={fmtDeg(suggested)} highlight />
        {variant === "5m" ? (
          <StatCard
            label="Retroceso"
            value={
              data?.retroceso?.meanAngleDeg != null
                ? `${fmtDeg(data.retroceso.meanAngleDeg)} · ${fmtPct(data.retroceso.meanPctOfTrend)} of trend`
                : "—"
            }
          />
        ) : null}
      </div>

      {data?.evaluatedAt || data?.scoredThisRun != null ? (
        <p className="text-[11px] text-ocean-sand/80">
          {data.evaluatedAt ? `Evaluated ${data.evaluatedAt}` : null}
          {data.scoredThisRun != null ? ` · scored this run ${data.scoredThisRun}` : null}
          {data.bestBucket?.label
            ? ` · best bucket ${data.bestBucket.label} (${fmtPct(data.bestBucket.achievedPct)} of ${data.bestBucket.sampleSize})`
            : null}
        </p>
      ) : null}

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ocean-sand">
          {copy.study} percentiles
        </h4>
        <div className="overflow-x-auto rounded-md border border-ocean-mid/30">
          <table className="min-w-full text-left text-xs text-ocean-foam">
            <thead className="bg-ocean-mid/20 text-ocean-sand">
              <tr>
                <th className="px-3 py-2 font-medium">Group</th>
                <th className="px-3 py-2 font-medium">n</th>
                <th className="px-3 py-2 font-medium">Mean</th>
                <th className="px-3 py-2 font-medium">p25</th>
                <th className="px-3 py-2 font-medium">p50</th>
                <th className="px-3 py-2 font-medium">p75</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["All", angle?.all],
                  ["Achieved", angle?.achieved],
                  ["Missed", angle?.missed],
                ] as const
              ).map(([label, stats]) => (
                <tr key={label} className="border-t border-ocean-mid/20">
                  <td className="px-3 py-1.5">{label}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmtNum(stats?.sampleSize)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmtDeg(stats?.mean)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmtDeg(stats?.p25)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmtDeg(stats?.p50)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmtDeg(stats?.p75)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ocean-sand">
          Angle buckets
        </h4>
        {buckets.length === 0 ? (
          <p className="text-xs text-ocean-sand">No scored buckets yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-ocean-mid/30">
            <table className="min-w-full text-left text-xs text-ocean-foam">
              <thead className="bg-ocean-mid/20 text-ocean-sand">
                <tr>
                  <th className="px-3 py-2 font-medium">Band</th>
                  <th className="px-3 py-2 font-medium">n</th>
                  <th className="px-3 py-2 font-medium">Hit rate</th>
                  <th className="px-3 py-2 font-medium">Median MFE</th>
                  <th className="px-3 py-2 font-medium">Mean MFE</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((row) => {
                  const isBest = data?.bestBucket?.label === row.label;
                  return (
                    <tr
                      key={row.label}
                      className={cn(
                        "border-t border-ocean-mid/20",
                        isBest && "bg-ocean-teal/10",
                      )}
                    >
                      <td className="px-3 py-1.5">
                        {row.label}
                        {isBest ? (
                          <span className="ml-2 text-[10px] font-semibold text-ocean-teal">best</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-1.5 tabular-nums">{row.sampleSize}</td>
                      <td className="px-3 py-1.5 tabular-nums">
                        {fmtPct(row.achievedPct)} ({row.achievedCount})
                      </td>
                      <td className="px-3 py-1.5 tabular-nums">{fmtPct(row.medianMfePct, 2)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{fmtPct(row.meanMfePct, 2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {variant === "5m" ? (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ocean-sand">
            Entry path (via)
          </h4>
          {via.length === 0 ? (
            <p className="text-xs text-ocean-sand">No via split yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-ocean-mid/30">
              <table className="min-w-full text-left text-xs text-ocean-foam">
                <thead className="bg-ocean-mid/20 text-ocean-sand">
                  <tr>
                    <th className="px-3 py-2 font-medium">Path</th>
                    <th className="px-3 py-2 font-medium">n</th>
                    <th className="px-3 py-2 font-medium">Hit rate</th>
                  </tr>
                </thead>
                <tbody>
                  {via.map((row) => (
                    <tr key={row.label} className="border-t border-ocean-mid/20">
                      <td className="px-3 py-1.5 capitalize">{row.label}</td>
                      <td className="px-3 py-1.5 tabular-nums">{row.sampleSize}</td>
                      <td className="px-3 py-1.5 tabular-nums">
                        {fmtPct(row.achievedPct)} ({row.achievedCount})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2",
        highlight ? "border-ocean-teal/40 bg-ocean-teal/10" : "border-ocean-mid/30 bg-ocean-mid/10",
      )}
    >
      <div className="text-[10px] uppercase tracking-wide text-ocean-sand">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-ocean-foam">{value}</div>
    </div>
  );
}
