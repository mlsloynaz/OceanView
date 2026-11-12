import { cn } from "@/shared/lib/cn";
import type { TrendPredictThreshold, TrendProfileResponse, TrendProfileRow } from "./types";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const HORIZONS = [5, 10, 15, 20, 30] as const;

function fmtPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function fmtCount(hits: number | null | undefined, signals: number | null | undefined): string {
  if (hits == null || signals == null) return "—";
  return `${hits}/${signals}`;
}

function fmtMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `$${value.toFixed(2)}`;
}

function fmtSigned(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

function detailTitle(row: TrendPredictThreshold): string {
  return [
    `median angle ${fmtSigned(row.medianAngle, 1)}°`,
    `acceleration ${fmtSigned(row.medianAccel, 1)}`,
    `ATR slope ${fmtSigned(row.medianAtrSlope, 3)}`,
    `1m separation ${fmtSigned(row.medianSep1m, 3)}%`,
    `5m separation ${fmtSigned(row.medianSep5m, 3)}%`,
    `gap narrowing ${fmtPct(row.gapNarrowingPct)}`,
    `price vs EMA10 ${fmtSigned(row.medianPriceVsEma10, 3)}%`,
    `price vs EMA21 ${fmtSigned(row.medianPriceVsEma21, 3)}%`,
    `minute ${row.medianMinute ?? "—"}`,
  ].join(" · ");
}

function stockMove(row: TrendProfileRow): string {
  if (row.moveDollars35 == null) return "No stock move yet";
  return `35% needs ${fmtMoney(row.moveDollars35)} of stock`;
}

type Props = {
  data: TrendProfileResponse | null;
  loading: boolean;
  evaluating: boolean;
  error: string | null;
  onEvaluate: () => Promise<void>;
  onRecalculate: () => Promise<void>;
  onReload: () => Promise<void>;
};

export function BestFitTrendProfileSection({
  data,
  loading,
  evaluating,
  error,
  onEvaluate,
  onRecalculate,
  onReload,
}: Props) {
  const calculating = evaluating || data?.status === "running";
  const busy = loading || calculating;
  const ranked = data?.ranked ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h3 className="text-sm font-semibold text-ocean-foam">1m angle before the 5m cross</h3>
          <p className="mt-1 text-xs leading-relaxed text-ocean-sand">
            Each row is the first time the 1-minute EMA10 relative angle reaches that degree while the
            last completed 5-minute candle still has EMA10 on the other side of EMA21. The forming
            5-minute candle is not used. A threshold fires once per episode, so one trend is not counted
            on every candle. The cross columns are a completed 5-minute candle that crosses in that
            direction within 5, 10, 15, 20, or 30 minutes. 35% at the 1m signal enters on that minute's
            close. 35% after the 5m cross enters on the confirming 5-minute close, and only when the
            cross arrived within 30 minutes. Lead is the stock already traveled by the time that cross
            prints. The best angle is the highest 30-minute cross rate with at least 3 signals. Hover an
            angle for the acceleration, ATR slope, separations, and time of day.             The relative angle still uses 0.10% of price as 45°, the same formula as the alarms. This
            replaces the study that scored the angle after the cross. Alarms are unchanged.
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
          <button
            type="button"
            disabled={busy}
            onClick={() => void onRecalculate()}
            title="Deletes every saved 5m profile, then calculates again"
            className={cn(BTN, "border border-ocean-danger/50 text-ocean-danger hover:bg-ocean-danger/10")}
          >
            Recalculate
          </button>
        </div>
      </div>

      {error ? <p className="text-xs text-ocean-danger">{error}</p> : null}
      {data?.message ? <p className="text-xs text-ocean-sand/90">{data.message}</p> : null}

      <div className="overflow-x-auto rounded-md border border-ocean-mid/30">
        <table className="min-w-[1100px] w-full text-left text-xs text-ocean-foam">
          <thead className="bg-ocean-mid/20 text-ocean-sand">
            <tr>
              <th className="px-3 py-2 font-medium">Ticker</th>
              <th className="px-3 py-2 font-medium">Angle</th>
              <th className="px-3 py-2 font-medium">Signals</th>
              {HORIZONS.map((minutes) => (
                <th key={minutes} className="px-3 py-2 font-medium">
                  {minutes}m cross
                </th>
              ))}
              <th className="px-3 py-2 font-medium">35% at 1m</th>
              <th className="px-3 py-2 font-medium">35% after 5m</th>
              <th className="px-3 py-2 font-medium">Lead</th>
            </tr>
          </thead>
          <tbody>
            {ranked.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-ocean-sand">
                  {loading ? "Loading profiles…" : calculating ? "Calculating…" : "No calculated profiles yet."}
                </td>
              </tr>
            ) : (
              ranked.map((row) => {
                const thresholds = (row.thresholds ?? []).filter((item) => (item.signals ?? 0) > 0);
                if (thresholds.length === 0) {
                  return (
                    <tr key={row.symbol} className="border-t border-ocean-mid/20 align-top">
                      <td className="px-3 py-2 font-semibold">
                        {row.symbol}
                        <div className="text-[10px] font-normal text-ocean-sand">{stockMove(row)}</div>
                      </td>
                      <td colSpan={10} className="px-3 py-2 text-ocean-sand">
                        {row.note ?? "No 1m signal in this history."}
                      </td>
                    </tr>
                  );
                }
                return thresholds.map((item, index) => {
                  const best = item.angleDeg === row.bestAngleDeg && (item.signals ?? 0) >= 3;
                  return (
                    <tr
                      key={`${row.symbol}-${item.angleDeg}`}
                      className={cn("border-t border-ocean-mid/20 align-top", best && "bg-ocean-teal/10")}
                    >
                      {index === 0 ? (
                        <td className="px-3 py-2 font-semibold" rowSpan={thresholds.length}>
                          {row.symbol}
                          <div className="text-[10px] font-normal text-ocean-sand">{stockMove(row)}</div>
                          {row.note ? (
                            <div className="mt-0.5 max-w-[14rem] text-[10px] font-normal text-ocean-sand/80">
                              {row.note}
                            </div>
                          ) : null}
                        </td>
                      ) : null}
                      <td className="px-3 py-2" title={detailTitle(item)}>
                        <span className={cn(best && "font-semibold text-ocean-foam")}>
                          {item.angleDeg}°{best ? " best" : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{item.signals ?? 0}</td>
                      {HORIZONS.map((minutes) => (
                        <td key={minutes} className="px-3 py-2">
                          <div className="tabular-nums">
                            {fmtPct(item[`pct${minutes}` as keyof TrendPredictThreshold] as number | null)}
                          </div>
                          <div className="text-[10px] text-ocean-sand">
                            {fmtCount(
                              item[`cross${minutes}` as keyof TrendPredictThreshold] as number | null,
                              item.signals,
                            )}
                          </div>
                        </td>
                      ))}
                      <td className="px-3 py-2 tabular-nums">{fmtPct(item.earlyPct35)}</td>
                      <td className="px-3 py-2">
                        <div className="tabular-nums">{fmtPct(item.latePct35)}</div>
                        <div className="text-[10px] text-ocean-sand">{item.lateSignals ?? 0} crosses</div>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{fmtMoney(item.medianLead)}</td>
                    </tr>
                  );
                });
              })
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
