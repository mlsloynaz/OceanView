import { orb5mHelpByColumn } from "./best-fit-orb5m-column-help";
import type { BestFitOrb5mRow } from "./types";

const HELP = orb5mHelpByColumn();

function fmtPct(value: number | null | undefined, digits = 1): string | null {
  if (value == null || Number.isNaN(value)) return null;
  return `${value.toFixed(digits)}%`;
}

function fmtUsd(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value)) return null;
  const digits = Math.abs(value) >= 0.1 ? 2 : 3;
  return `$${value.toFixed(digits)}`;
}

function gapDollars(
  pct: number | null | undefined,
  price: number | null | undefined,
): number | null {
  if (pct == null || price == null || Number.isNaN(pct) || Number.isNaN(price) || price <= 0) {
    return null;
  }
  return (price * pct) / 100;
}

function fmtGap(
  pct: number | null | undefined,
  dollars: number | null | undefined,
  lastClose: number | null | undefined,
): string | null {
  const money = fmtUsd(dollars);
  const percent = fmtPct(pct, 2);
  const close = fmtUsd(lastClose);
  if (money && percent && close) return `${money}  (${percent} of last close ${close})`;
  if (money && percent) return `${money}  (${percent} of last close)`;
  return money ?? percent;
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  const help = HELP[label];
  return (
    <div className="rounded-md border border-ocean-mid/25 bg-ocean-surface/40 px-3 py-2">
      <dt className="text-[11px] font-medium text-ocean-sand">{label}</dt>
      {help ? <p className="mt-0.5 text-[10px] leading-snug text-ocean-sand/75">{help.meaning}</p> : null}
      <dd className="mt-1.5 text-base font-semibold tabular-nums text-ocean-foam">{value}</dd>
    </div>
  );
}

type Props = {
  row: BestFitOrb5mRow;
  fallbackPrice?: number | null;
};

export function BestFitOrb5mTickerDetail({ row, fallbackPrice }: Props) {
  const m = row.metrics ?? {};
  const sample = typeof m.sampleSize === "number" ? m.sampleSize : m.eventCount ?? null;
  const lastClose = m.referencePrice ?? fallbackPrice ?? null;
  const sma10Dollars = m.sma10TurnGapDollars ?? gapDollars(m.mostFrequentSma10TurnGapPct, lastClose);
  const medianDollars = gapDollars(m.medianSma10TurnGapPct, lastClose);
  const avgPathDollars = gapDollars(m.avgReturnToSma10Pct, lastClose);

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
        Each card is one metric. The text under the name is what that number means.
      </p>

      <dl className="grid gap-2 sm:grid-cols-2">
        <Metric label="Sample" value={sample != null ? `${sample} entries` : null} />
        <Metric label="Follow" value={fmtPct(m.followedPct)} />
        <Metric label="Earned 20" value={fmtPct(m.earned20Pct)} />
        <Metric label="Earned 35" value={fmtPct(m.earned35Pct)} />
        <Metric label="vs 1h" value={fmtPct(m.withTrendPct)} />
        <Metric label="vs VWAP" value={fmtPct(m.withVwapPct)} />
        <Metric
          label="VWAP − vs 1h"
          value={
            m.vwapMinusTrendPct == null || Number.isNaN(m.vwapMinusTrendPct)
              ? null
              : `${m.vwapMinusTrendPct > 0 ? "+" : ""}${m.vwapMinusTrendPct.toFixed(1)} pp`
          }
        />
        <Metric label="Next=1h" value={fmtPct(m.succeedNextEq1hTrendPct)} />
        <Metric label="Next+Vol" value={fmtPct(m.succeedNextWithVolPct)} />
        <Metric label="Against 1h trend" value={fmtPct(m.againstTrendPct)} />
        <Metric label="Against VWAP" value={fmtPct(m.againstVwapPct)} />
        <Metric label="Stayed beyond OR" value={fmtPct(m.stayedBeyondOrPct)} />
        <Metric label="Signal rate" value={fmtPct(m.signalRatePct)} />
        <Metric label="Hour" value={m.mostProbableHourEt ?? null} />
        <Metric
          label="SMA10"
          value={fmtGap(m.mostFrequentSma10TurnGapPct, sma10Dollars, lastClose)}
        />
        <Metric
          label="Median SMA(10) snap-back"
          value={fmtGap(m.medianSma10TurnGapPct, medianDollars, lastClose)}
        />
        <Metric label="Turned toward SMA(10)" value={fmtPct(m.sma10TurnPct)} />
        <Metric
          label="Avg path back to SMA(10)"
          value={fmtGap(m.avgReturnToSma10Pct, avgPathDollars, lastClose)}
        />
        <Metric label="Avg MFE" value={fmtPct(m.avgMfePct, 2)} />
        <Metric label="Avg MAE" value={fmtPct(m.avgMaePct, 2)} />
        <Metric
          label="CALL / PUT"
          value={
            m.callCount != null || m.putCount != null
              ? `${m.callCount ?? 0} / ${m.putCount ?? 0}`
              : null
          }
        />
        <Metric
          label="History window"
          value={
            m.historyStart || m.historyEnd
              ? `${m.historyStart ?? "?"} → ${m.historyEnd ?? "?"}`
              : null
          }
        />
        <Metric
          label="Sessions"
          value={
            m.sessionsWithOpeningRange != null
              ? `${m.sessionsWithOpeningRange} with OR / ${m.sessionsInRange ?? "—"} scanned`
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
    </div>
  );
}
