import type { BestFitWatchlistRow } from "./types";

function fmtPct(value: number | null | undefined, digits = 2): string | null {
  if (value == null || Number.isNaN(value)) return null;
  return `${value.toFixed(digits)}%`;
}

function fmtMoney(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value) || value <= 0) return null;
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtRate(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value)) return null;
  return `${(value * 100).toFixed(0)}%`;
}

function pctAndDollars(
  pct: number | null | undefined,
  dollars: number | null | undefined,
): string | null {
  const p = fmtPct(pct);
  const d = fmtMoney(dollars);
  if (p && d) return `${p} ≈ ${d}`;
  return p ?? d;
}

function Metric({ label, value, hint }: { label: string; value: string | null; hint?: string }) {
  if (!value) return null;
  return (
    <div className="rounded-md border border-ocean-mid/25 bg-ocean-surface/40 px-3 py-2">
      <dt className="text-[11px] font-medium text-ocean-sand">{label}</dt>
      {hint ? <p className="mt-0.5 text-[10px] leading-snug text-ocean-sand/65">{hint}</p> : null}
      <dd className="mt-1.5 text-base font-semibold tabular-nums text-ocean-foam">{value}</dd>
    </div>
  );
}

type Props = {
  row: BestFitWatchlistRow;
};

/**
 * Click-detail for a Best-fit row: movement fitness with % and $ side by side.
 * Score is movement-profile fitness — not strategy hit rate.
 */
export function BestFitTickerDetail({ row }: Props) {
  const m = row.metrics ?? {};
  const sample = typeof m.sampleSize === "number" ? m.sampleSize : null;
  const winRate = typeof m.winRate === "number" ? m.winRate : null;
  const winsApprox =
    sample != null && winRate != null ? Math.round(sample * winRate) : null;

  return (
    <div className="space-y-4 text-sm text-ocean-foam">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-lg font-semibold">{row.symbol}</span>
        {row.name ? <span className="text-ocean-sand">{row.name}</span> : null}
        <span className="rounded bg-ocean-teal/15 px-2 py-0.5 text-xs font-medium tabular-nums text-ocean-teal-dim dark:text-ocean-teal">
          Score {row.score.toFixed(1)} · {row.tier}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-ocean-sand">
        This score ranks how well the ticker’s <span className="text-ocean-foam">past breakout
        movement</span> fits our style (typical upside, drawdown, win rate, ATR). It is{" "}
        <span className="text-ocean-foam">not</span> how often named strategies fired true on this
        ticker — that needs Research Stats (or future strategy telemetry).
      </p>

      <dl className="grid gap-2 sm:grid-cols-2">
        <Metric
          label="Reference price"
          value={fmtMoney(m.referencePrice)}
          hint="Last close used to turn % into $"
        />
        <Metric
          label="Sample size"
          value={sample != null ? `${sample} breakouts` : null}
          hint="How many past setups these stats come from"
        />
        <Metric
          label="Typical upside (MFE)"
          value={pctAndDollars(m.moveCapPct, m.moveCapDollars)}
          hint="Average move in your favor after breakout"
        />
        <Metric
          label="Typical drawdown (MAE)"
          value={pctAndDollars(m.expectedMaePct, m.expectedMaeDollars)}
          hint="Average move against you before recovery"
        />
        <Metric
          label="Historical win rate"
          value={
            winsApprox != null && sample != null && fmtRate(winRate)
              ? `${fmtRate(winRate)} (~${winsApprox} of ${sample} setups)`
              : fmtRate(winRate)
          }
          hint="Share of past breakouts that worked in the sample"
        />
        <Metric
          label="Suggested stop"
          value={pctAndDollars(m.suggestedStopPct, m.suggestedStopDollars)}
        />
        <Metric label="Typical daily range (ATR)" value={pctAndDollars(m.atrPct, m.atrDollars)} />
        <Metric label="Expected exit (approx.)" value={fmtMoney(m.expectedExitPrice)} />
        <Metric label="Reach ≥5%" value={fmtRate(m.reachProb5)} />
        <Metric label="Reach ≥10%" value={fmtRate(m.reachProb10)} />
        <Metric label="Reach ≥12%" value={fmtRate(m.reachProb12)} />
        <Metric
          label="History window"
          value={
            m.historyStart || m.historyEnd
              ? `${m.historyStart ?? "?"} → ${m.historyEnd ?? "?"}`
              : null
          }
        />
      </dl>

      {row.reasons?.length ? (
        <div>
          <p className="mb-1 text-[11px] font-medium text-ocean-sand">Score breakdown</p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-ocean-sand">
            {row.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="rounded-md border border-ocean-mid/30 bg-ocean-surface/30 px-3 py-2 text-[11px] leading-relaxed text-ocean-sand">
        Strategy appearance counts (how often each strategy was true on this ticker) and earnings %
        by direction are not stored on Best-fit yet. Use Admin → Research Stats for a one-off check,
        or we can add persisted strategy telemetry later.
      </p>
    </div>
  );
}
