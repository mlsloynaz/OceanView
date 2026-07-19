import { cn } from "@/shared/lib/cn";
import type { MovementProfile } from "@/features/premarket/types";

type Props = {
  profile: MovementProfile | null | undefined;
  updatedAt?: string | null;
  historyBars?: number | null;
  loading?: boolean;
  error?: string | null;
  className?: string;
};

function pct(n: number | null | undefined, digits = 2): string | null {
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return `${n.toFixed(digits)}%`;
}

function money(n: number | null | undefined): string | null {
  if (typeof n !== "number" || Number.isNaN(n) || n <= 0) return null;
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function timeframeLabel(tf: string | undefined): string {
  if (tf === "15m") return "15-minute chart";
  if (tf === "1h") return "hourly chart";
  if (tf === "1d") return "daily chart";
  return tf ? `${tf} chart` : "primary chart";
}

/** Label on top, value directly under — no wide left/right gap. */
function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | null | undefined;
  hint?: string;
}) {
  if (!value) return null;
  return (
    <div className="rounded-md border border-ocean-mid/25 bg-ocean-surface/40 px-3 py-2">
      <dt className="text-[11px] font-medium leading-snug text-ocean-sand">{label}</dt>
      {hint ? (
        <p className="mt-0.5 text-[10px] leading-snug text-ocean-sand/65">{hint}</p>
      ) : null}
      <dd className="mt-1.5 text-base font-semibold tabular-nums tracking-tight text-ocean-foam">
        {value}
      </dd>
    </div>
  );
}

function MaMetric({
  label,
  now,
  percentile,
  typical,
  stretched,
}: {
  label: string;
  now: string | null;
  percentile?: number | null;
  typical: string | null;
  stretched?: boolean;
}) {
  if (!now) return null;
  return (
    <div className="rounded-md border border-ocean-mid/25 bg-ocean-surface/40 px-3 py-2">
      <dt className="text-[11px] font-medium text-ocean-sand">{label}</dt>
      <dd className="mt-1.5 space-y-1">
        <p className="text-base font-semibold tabular-nums text-ocean-foam">
          {now}
          {stretched ? (
            <span className="ml-2 text-xs font-semibold uppercase text-ocean-danger">Stretched</span>
          ) : null}
        </p>
        <ul className="space-y-0.5 text-[11px] leading-snug text-ocean-sand">
          {typeof percentile === "number" ? (
            <li>
              <span className="text-ocean-sand/70">Vs this ticker’s history: </span>
              <span className="tabular-nums text-ocean-foam">{percentile}th percentile</span>
            </li>
          ) : null}
          {typical ? (
            <li>
              <span className="text-ocean-sand/70">Usually about: </span>
              <span className="tabular-nums text-ocean-foam">{typical}</span>
            </li>
          ) : null}
        </ul>
      </dd>
    </div>
  );
}

/**
 * Admin Tickers — full stored movement profile with plain-language labels.
 * Stacked metrics (label above value) so rows stay easy to scan.
 */
export function TickerMovementInfoPanel({
  profile,
  updatedAt,
  historyBars,
  loading,
  error,
  className,
}: Props) {
  if (loading) {
    return (
      <div className={cn("px-3 py-2 text-sm text-ocean-sand", className)}>Loading movement info…</div>
    );
  }

  if (error) {
    return (
      <div className={cn("px-3 py-2 text-sm text-ocean-danger", className)} role="alert">
        {error}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={cn("px-3 py-2 text-sm text-ocean-sand", className)}>
        No stored profile yet — run <strong className="text-ocean-foam">Build movement profiles</strong>{" "}
        on Admin → Candles.
      </div>
    );
  }

  const p = profile;
  const ma = p.maDistance;
  const exhaustion = Boolean(p.exhaustionRisk);
  const remaining = pct(p.remainingMfePct) || pct(p.moveCapRemainingPct);
  const alreadyRan = pct(p.currentMfePct);
  const typicalMove = pct(p.moveCapPct) || pct(p.expectedMfePct);
  const stretchMove = pct(p.stretchMoveCapPct) || pct(p.p75MfePct);
  const adverse = pct(p.expectedMaePct);

  const reachBits =
    p.reachProb &&
    ["5", "10", "12", "15", "20"]
      .map((k) => {
        const v = p.reachProb?.[k];
        if (typeof v !== "number") return null;
        return { key: k, pctOfBreakouts: Math.round(v * 100) };
      })
      .filter(Boolean) as { key: string; pctOfBreakouts: number }[];

  return (
    <div
      className={cn(
        "space-y-4 border-t border-ocean-mid/30 bg-ocean-deep/20 px-3 py-3",
        exhaustion && "bg-ocean-danger/10",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ocean-sand">
          How this ticker usually moves
          {p.timeframe ? ` · ${timeframeLabel(p.timeframe)}` : ""}
        </h4>
        {exhaustion && (
          <span className="text-xs font-semibold uppercase tracking-wide text-ocean-danger">
            Stop suggested
          </span>
        )}
      </div>

      <dl className="grid gap-2 sm:grid-cols-2">
        <Metric label="Last close" value={money(p.referencePrice)} />
        <Metric
          label="Breakout start price"
          value={money(p.sequenceEntryPrice)}
          hint="First bar of the current outside-Bollinger spell (when active)."
        />
        <Metric label="Typical exit price" value={money(p.expectedExitPrice)} />
        <Metric
          label="Typical favorable move"
          value={typicalMove ? `${typicalMove} of the stock price` : null}
          hint="Median run after a historical Bollinger close breakout."
        />
        <Metric label="Stronger exit price" value={money(p.stretchExitPrice)} />
        <Metric
          label="Stronger favorable move"
          value={stretchMove ? `${stretchMove} of the stock price` : null}
          hint="Upper-range history (75th percentile)."
        />
        <Metric
          label="Room left in a typical move"
          value={
            remaining
              ? alreadyRan
                ? `${remaining} left (already moved ${alreadyRan})`
                : remaining
              : null
          }
        />
        <Metric label="Move already done" value={!remaining && alreadyRan ? alreadyRan : null} />
        <Metric
          label="Typical adverse move (risk)"
          value={adverse ? `${adverse} of the stock price` : null}
        />
      </dl>

      {ma && (
        <div className="space-y-2 border-t border-ocean-mid/30 pt-3">
          <h5 className="text-xs font-semibold text-ocean-sand">
            Distance from this ticker’s usual averages
          </h5>
          <dl className="grid gap-2 sm:grid-cols-1 lg:grid-cols-3">
            <MaMetric
              label="Distance from 20-bar average"
              now={pct(ma.ma20DistancePct)}
              percentile={ma.ma20DistancePercentile}
              typical={pct(ma.typicalMa20DistancePct)}
              stretched={Boolean(ma.maExtended)}
            />
            <MaMetric
              label="Distance from 40-bar average"
              now={pct(ma.ma40DistancePct)}
              percentile={ma.ma40DistancePercentile}
              typical={pct(ma.typicalMa40DistancePct)}
            />
            <MaMetric
              label="Gap between 20- and 40-bar averages"
              now={pct(ma.maStackSepPct)}
              percentile={ma.maStackSepPercentile}
              typical={pct(ma.typicalMaStackSepPct)}
            />
          </dl>
        </div>
      )}

      {reachBits && reachBits.length > 0 && (
        <div className="space-y-2 border-t border-ocean-mid/30 pt-3">
          <h5 className="text-xs font-semibold text-ocean-sand">
            How often past breakouts reached…
          </h5>
          <p className="text-[10px] leading-snug text-ocean-sand/70">
            Of historical Bollinger close breakouts for this ticker, what share saw a favorable stock
            move of at least this size (not option P&amp;L).
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {reachBits.map((row) => (
              <li
                key={row.key}
                className="rounded-md border border-ocean-mid/25 bg-ocean-surface/40 px-3 py-2"
              >
                <span className="block text-[11px] text-ocean-sand">
                  At least {row.key}% of stock price
                </span>
                <span className="mt-1 block text-sm font-semibold tabular-nums text-ocean-foam">
                  {row.pctOfBreakouts}% of breakouts
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {typeof p.sampleSize === "number" && (
        <p className="text-[11px] leading-relaxed text-ocean-sand">
          Based on {p.sampleSize} past breakout{p.sampleSize === 1 ? "" : "s"}
          {p.horizonBars ? ` · looking ${p.horizonBars} bars ahead` : ""}
          {p.historyStart && p.historyEnd
            ? ` · history ${String(p.historyStart).slice(0, 10)} → ${String(p.historyEnd).slice(0, 10)}`
            : ""}
          {typeof historyBars === "number" ? ` · ${historyBars} hourly bars used` : ""}
          {updatedAt ? ` · updated ${String(updatedAt).slice(0, 19).replace("T", " ")} UTC` : ""}
        </p>
      )}

      {exhaustion && (
        <p className="text-xs font-semibold text-ocean-danger">
          This move looks stretched for this ticker — consider parking or exiting.
        </p>
      )}

      {(p.warnings?.length ?? 0) > 0 && (
        <p className="text-[11px] text-ocean-sand">{p.warnings?.join(" · ")}</p>
      )}
    </div>
  );
}
