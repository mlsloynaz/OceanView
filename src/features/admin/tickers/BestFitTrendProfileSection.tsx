import { cn } from "@/shared/lib/cn";
import type { TrendProfileMetric, TrendProfileResponse } from "./types";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "1D"] as const;

function fmtPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function fmtDeg(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(0)}°`;
}

function fmtMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `$${value.toFixed(2)}`;
}

function fmtSep(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(2)}%`;
}

function metric(
  profile: TrendProfileResponse["ranked"][number]["profile"],
  timeframe: string,
  kind: "angl" | "sep",
): TrendProfileMetric | null {
  const block = profile?.[timeframe];
  if (!block) return null;
  const row = block[`${timeframe}-${kind}-toprated`];
  if (!row || typeof row === "number") return null;
  return row;
}

function MetricLines({ row }: { row: TrendProfileMetric | null }) {
  if (!row || row.pct == null) {
    return <span className="text-ocean-sand/70">—</span>;
  }
  const cutoff = row.angleDeg != null ? fmtDeg(row.angleDeg) : fmtSep(row.separationPct);
  return (
    <div className="leading-snug">
      <div className="font-medium text-ocean-foam">
        {cutoff} · {fmtPct(row.pct)}
      </div>
      <div className="text-[10px] text-ocean-sand">
        {fmtMoney(row.earning)} · {row.trades ?? 0} trades
      </div>
    </div>
  );
}

type Props = {
  data: TrendProfileResponse | null;
  loading: boolean;
  evaluating: boolean;
  error: string | null;
  onEvaluate: () => Promise<void>;
  onReload: () => Promise<void>;
};

export function BestFitTrendProfileSection({
  data,
  loading,
  evaluating,
  error,
  onEvaluate,
  onReload,
}: Props) {
  const calculating = evaluating || data?.status === "running";
  const busy = loading || calculating;
  const ranked = data?.ranked ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h3 className="text-sm font-semibold text-ocean-foam">$1 follow-through</h3>
          <p className="mt-1 text-xs leading-relaxed text-ocean-sand">
            After EMA 10 crosses EMA 21, this is the angle and the separation where price most
            often moves at least $1 over the next 30 bars, while the cross still holds. On 1m and
            5m those bars stay inside the session. On 15m, 1h, and 1D they run on. The angle uses
            0.10% of price as 45°. Separation is the EMA 10 to EMA 21 gap as a percent of price.
            Sorted by the highest percentage, then by the median favorable dollars at that angle.
          </p>
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
            {calculating ? "Calculating…" : "Calculate from Alpaca"}
          </button>
        </div>
      </div>

      {error ? <p className="text-xs text-ocean-danger">{error}</p> : null}
      {data?.message ? <p className="text-xs text-ocean-sand/90">{data.message}</p> : null}

      <div className="overflow-x-auto rounded-md border border-ocean-mid/30">
        <table className="min-w-[980px] w-full text-left text-xs text-ocean-foam">
          <thead className="bg-ocean-mid/20 text-ocean-sand">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Ticker</th>
              <th className="px-3 py-2 font-medium">Best $1 rate</th>
              {TIMEFRAMES.map((timeframe) => (
                <th key={timeframe} className="px-3 py-2 font-medium">
                  {timeframe}
                  <div className="text-[10px] font-normal text-ocean-sand/80">angle · separation</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranked.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-ocean-sand">
                  {loading ? "Loading profiles…" : "No calculated profiles yet."}
                </td>
              </tr>
            ) : (
              ranked.map((row, index) => (
                <tr key={row.symbol} className="border-t border-ocean-mid/20 align-top">
                  <td className="px-3 py-2 text-ocean-sand">{index + 1}</td>
                  <td className="px-3 py-2 font-semibold">{row.symbol}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{fmtPct(row.bestPct)}</div>
                    <div className="text-[10px] text-ocean-sand">
                      {row.bestAngleDeg != null ? fmtDeg(row.bestAngleDeg) : "—"}
                      {row.bestTimeframe ? ` · ${row.bestTimeframe}` : ""}
                      {row.bestEarning != null ? ` · ${fmtMoney(row.bestEarning)}` : ""}
                    </div>
                  </td>
                  {TIMEFRAMES.map((timeframe) => (
                    <td key={timeframe} className="px-3 py-2">
                      <div className="grid gap-1.5">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-ocean-sand/70">Angle</div>
                          <MetricLines row={metric(row.profile, timeframe, "angl")} />
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-ocean-sand/70">Separation</div>
                          <MetricLines row={metric(row.profile, timeframe, "sep")} />
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data?.missing?.length ? (
        <p className="text-[11px] text-ocean-sand/80">
          Not calculated yet: {data.missing.join(", ")}
        </p>
      ) : null}
      {data?.errors?.length ? (
        <ul className="space-y-1 text-[11px] text-ocean-danger">
          {data.errors.map((item) => (
            <li key={item.symbol}>
              {item.symbol}: {item.error}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
