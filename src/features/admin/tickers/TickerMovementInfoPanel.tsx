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
  const typicalMovePct =
    typeof p.moveCapPct === "number" && !Number.isNaN(p.moveCapPct)
      ? p.moveCapPct
      : typeof p.expectedMfePct === "number" && !Number.isNaN(p.expectedMfePct)
        ? p.expectedMfePct
        : null;
  const stretchMovePct =
    typeof p.stretchMoveCapPct === "number" && !Number.isNaN(p.stretchMoveCapPct)
      ? p.stretchMoveCapPct
      : typeof p.p75MfePct === "number" && !Number.isNaN(p.p75MfePct)
        ? p.p75MfePct
        : null;
  const adversePct =
    typeof p.expectedMaePct === "number" && !Number.isNaN(p.expectedMaePct)
      ? p.expectedMaePct
      : null;
  const refPx =
    typeof p.referencePrice === "number" && !Number.isNaN(p.referencePrice) && p.referencePrice > 0
      ? p.referencePrice
      : null;
  const typicalMove = typicalMovePct != null ? pct(typicalMovePct) : null;
  const stretchMove = stretchMovePct != null ? pct(stretchMovePct) : null;
  const adverse = adversePct != null ? pct(adversePct) : null;
  const typicalMoveDollars =
    refPx != null && typicalMovePct != null ? refPx * (typicalMovePct / 100) : null;
  const stretchMoveDollars =
    refPx != null && stretchMovePct != null ? refPx * (stretchMovePct / 100) : null;
  const adverseMoveDollars =
    refPx != null && adversePct != null ? refPx * (adversePct / 100) : null;
  const mfeP75 = pct(p.p75MfePct) ?? stretchMove;
  const mfeP90 = pct(p.p90MfePct);
  const mfeAvg = pct(p.averageMfePct);
  const maeP75 = pct(p.p75MaePct);
  const maeP90 = pct(p.p90MaePct);
  const maeAvg = pct(p.averageMaePct);
  const pullback = pct(p.pullbackPct);
  const suggestedStop = pct(p.suggestedStopPct);
  const atrPct = pct(p.atrPct);
  const winRatePct =
    typeof p.winRate === "number" && !Number.isNaN(p.winRate)
      ? `${Math.round(p.winRate * 100)}%`
      : null;
  const timeToTarget =
    typeof p.timeToTargetBars === "number" && !Number.isNaN(p.timeToTargetBars)
      ? `${p.timeToTargetBars} bar${p.timeToTargetBars === 1 ? "" : "s"}`
      : null;

  const hasMaeDistribution = Boolean(adverse || maeP75 || maeP90 || maeAvg);
  const hasMfeDistribution = Boolean(typicalMove || mfeP75 || mfeP90 || mfeAvg);

  const reachBits =
    p.reachProb &&
    ["5", "10", "12", "15", "20"]
      .map((k) => {
        const v = p.reachProb?.[k];
        if (typeof v !== "number") return null;
        return { key: k, pctOfBreakouts: Math.round(v * 100) };
      })
      .filter(Boolean) as { key: string; pctOfBreakouts: number }[];

  const fallBits =
    p.fallProb &&
    ["5", "8", "10", "12", "15"]
      .map((k) => {
        const v = p.fallProb?.[k];
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
        <Metric label="Stronger exit price" value={money(p.stretchExitPrice)} />
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
      </dl>

      {hasMfeDistribution && (
        <div className="space-y-2 border-t border-ocean-mid/30 pt-3">
          <h5 className="text-xs font-semibold text-ocean-sand">
            Favorable excursion (MFE) — winners’ upside
          </h5>
          <p className="text-[10px] leading-snug text-ocean-sand/70">
            How far past Bollinger close breakouts typically ran in your favor (stock %, not option
            P&amp;L). Use median for expectations; p75/p90 for stretch targets and trailing stages.
          </p>
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Median MFE"
              value={typicalMove}
              hint={
                typicalMoveDollars != null
                  ? `≈ ${money(typicalMoveDollars)} from last close`
                  : "Typical favorable move after breakout."
              }
            />
            <Metric
              label="P75 MFE"
              value={mfeP75}
              hint="Stronger favorable move (75th percentile)."
            />
            <Metric
              label="P90 MFE"
              value={mfeP90}
              hint="Exceptional winners — trail, don’t assume this as base target."
            />
            <Metric label="Average MFE" value={mfeAvg} hint="Mean of historical favorable samples." />
            <Metric
              label="Median MFE ($)"
              value={money(typicalMoveDollars)}
              hint="Last close × median MFE %."
            />
            <Metric
              label="P75 MFE ($)"
              value={
                refPx != null && typeof p.p75MfePct === "number"
                  ? money(refPx * (p.p75MfePct / 100))
                  : money(stretchMoveDollars)
              }
            />
          </dl>
        </div>
      )}

      {hasMaeDistribution && (
        <div className="space-y-2 border-t border-ocean-mid/30 pt-3">
          <h5 className="text-xs font-semibold text-ocean-sand">
            Adverse excursion (MAE) — normal noise vs abnormal
          </h5>
          <p className="text-[10px] leading-snug text-ocean-sand/70">
            How far breakouts usually moved against the entry before resolving. OceanDesk can use
            median–p75 as structural room and treat p90+ as abnormal (not permission for unlimited
            loss).
          </p>
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Median MAE"
              value={adverse}
              hint={
                adverseMoveDollars != null
                  ? `≈ ${money(adverseMoveDollars)} from last close`
                  : "Typical adverse move (risk hint)."
              }
            />
            <Metric
              label="P75 MAE"
              value={maeP75}
              hint="Upper normal adverse zone — tighten monitoring."
            />
            <Metric
              label="P90 MAE"
              value={maeP90}
              hint="Beyond this is abnormal vs historical successful-style samples."
            />
            <Metric label="Average MAE" value={maeAvg} hint="Mean of historical adverse samples." />
            <Metric
              label="Median MAE ($)"
              value={money(adverseMoveDollars)}
              hint="Last close × median MAE %."
            />
            <Metric
              label="P75 MAE ($)"
              value={
                refPx != null && typeof p.p75MaePct === "number"
                  ? money(refPx * (p.p75MaePct / 100))
                  : null
              }
            />
            <Metric
              label="P90 MAE ($)"
              value={
                refPx != null && typeof p.p90MaePct === "number"
                  ? money(refPx * (p.p90MaePct / 100))
                  : null
              }
            />
          </dl>
        </div>
      )}

      {(suggestedStop || pullback || winRatePct || atrPct || timeToTarget) && (
        <div className="space-y-2 border-t border-ocean-mid/30 pt-3">
          <h5 className="text-xs font-semibold text-ocean-sand">Risk &amp; timing (stock)</h5>
          <p className="text-[10px] leading-snug text-ocean-sand/70">
            Suggested stop is a stock % from historical pullback / MAE (+10% buffer), floored at half
            ATR — not an option-premium stop. OceanDesk maps this to option % via Greeks over API.
          </p>
          <dl className="grid gap-2 sm:grid-cols-2">
            <Metric
              label="Suggested stop"
              value={suggestedStop}
              hint="max(pullback, typical MAE) × 1.1, at least half ATR%."
            />
            <Metric
              label="Pullback before continuation"
              value={pullback}
              hint="Typical adverse move before winners reach the usual favorable target."
            />
            <Metric
              label="Win rate"
              value={winRatePct}
              hint="Share of past breakouts where favorable move ≥ adverse move."
            />
            <Metric
              label="ATR (underlying)"
              value={
                atrPct
                  ? p.atr != null
                    ? `${atrPct} of price ($${Number(p.atr).toFixed(2)})`
                    : atrPct
                  : null
              }
              hint="ATR(14) on this profile’s chart."
            />
            <Metric
              label="Time to target"
              value={timeToTarget}
              hint="Median bars until a breakout first reaches this ticker’s typical favorable move."
            />
          </dl>
        </div>
      )}

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

      {fallBits && fallBits.length > 0 && (
        <div className="space-y-2 border-t border-ocean-mid/30 pt-3">
          <h5 className="text-xs font-semibold text-ocean-sand">
            How often adverse move exceeded…
          </h5>
          <p className="text-[10px] leading-snug text-ocean-sand/70">
            Share of past breakouts whose MAE went beyond each threshold (stock %). Useful for
            abnormal-MAE warnings in OceanDesk.
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {fallBits.map((row) => (
              <li
                key={row.key}
                className="rounded-md border border-ocean-mid/25 bg-ocean-surface/40 px-3 py-2"
              >
                <span className="block text-[11px] text-ocean-sand">
                  MAE above {row.key}% of stock price
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
