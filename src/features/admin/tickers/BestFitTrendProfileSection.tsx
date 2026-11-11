import { useMemo, useState } from "react";
import { cn } from "@/shared/lib/cn";
import type { TrendProfileMetric, TrendProfileResponse, TrendProfileRow } from "./types";

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

function stockMove(row: TrendProfileRow, target: 1 | 2): string {
  const dollars = target === 1 ? row.moveDollars20 : row.moveDollars35;
  if (dollars == null) return "No stock move yet";
  return `${target === 1 ? "20%" : "35%"} needs ${fmtMoney(dollars)} of stock`;
}

function sortRows(rows: TrendProfileRow[], target: 1 | 2): TrendProfileRow[] {
  if (target === 1) return rows;
  return [...rows].sort((left, right) => {
    if (left.bestPct2 == null && right.bestPct2 == null) return 0;
    if (left.bestPct2 == null) return 1;
    if (right.bestPct2 == null) return -1;
    if (right.bestPct2 !== left.bestPct2) return right.bestPct2 - left.bestPct2;
    return (right.bestEarning2 ?? 0) - (left.bestEarning2 ?? 0);
  });
}

function TabButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        BTN,
        active
          ? "border border-ocean-teal/50 bg-ocean-teal/15 text-ocean-foam"
          : "border border-ocean-mid/50 text-ocean-sand hover:border-ocean-teal/40",
      )}
    >
      {children}
    </button>
  );
}

function historyLine(
  profile: TrendProfileResponse["ranked"][number]["profile"],
  timeframe: string,
): string | null {
  const block = profile?.[timeframe] as { history?: { start?: string | null; end?: string | null; bars?: number | null } } | undefined;
  const history = block?.history;
  if (!history?.start || !history.end) return null;
  const count = history.bars != null ? ` · ${history.bars.toLocaleString()} bars` : "";
  return `${history.start} – ${history.end}${count}`;
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
        {fmtMoney(row.earning)} · {row.trades ?? 0} trades · reversed {fmtMoney(row.reverse)}
      </div>
      <div className="text-[10px] text-ocean-sand/70">
        2h {fmtPct(row.pct2h)} · reversed {fmtMoney(row.reverse2h)}
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
  const [target, setTarget] = useState<1 | 2>(1);
  const ranked = useMemo(() => sortRows(data?.ranked ?? [], target), [data, target]);
  const gain = target === 1 ? "20%" : "35%";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h3 className="text-sm font-semibold text-ocean-foam">{gain} option follow-through</h3>
          <p className="mt-1 text-xs leading-relaxed text-ocean-sand">
            After EMA 10 crosses EMA 21, the angle and the separation are read on the first bar
            where they clear, the cross bar or one of the next 10. The clock starts when that bar
            closes, and only while the cross still holds. A hit is the stock move that matches a{" "}
            {gain} option gain for that ticker. The 35% distance is the hardcoded Alpaca move for a
            Friday option with delta from 0.20 to 0.40. The 20% distance is 20/35 of that move. On 1m and 5m the half hour stays inside the session.
            A cutoff on 1m and 5m needs at least 100 trades. 15m, 1h, and 1D need 30, because
            those bars rarely produce 100 qualified trades in three months. A handful of perfect
            trades does not win over a larger sample. Reversed is how far price went against the trade, in the middle of the
            trades that still reached {gain}. The 2h line is the same idea over 2 hours and is not
            used to sort. The sort uses the 30-minute percentage, then the median favorable dollars.
            The relative angle uses 0.10% of price as 45°. The visual angle on the board is the
            TradingView reset and is not this number. These figures are research, not a live entry rule.
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

      <div className="flex gap-2">
        <TabButton active={target === 1} disabled={busy} onClick={() => setTarget(1)}>
          20% option
        </TabButton>
        <TabButton active={target === 2} disabled={busy} onClick={() => setTarget(2)}>
          35% option
        </TabButton>
      </div>

      {error ? <p className="text-xs text-ocean-danger">{error}</p> : null}
      {data?.message ? <p className="text-xs text-ocean-sand/90">{data.message}</p> : null}

      <div className="overflow-x-auto rounded-md border border-ocean-mid/30">
        <table className="min-w-[980px] w-full text-left text-xs text-ocean-foam">
          <thead className="bg-ocean-mid/20 text-ocean-sand">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Ticker</th>
              <th className="px-3 py-2 font-medium">Best 30m {gain}</th>
              {TIMEFRAMES.map((timeframe) => (
                <th key={timeframe} className="px-3 py-2 font-medium">
                  {timeframe}
                  <div className="text-[10px] font-normal text-ocean-sand/80">30m rates · 2h shown</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranked.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-ocean-sand">
                  {loading ? "Loading profiles…" : calculating ? "Calculating…" : "No calculated profiles yet."}
                </td>
              </tr>
            ) : (
              ranked.map((row, index) => (
                <tr key={row.symbol} className="border-t border-ocean-mid/20 align-top">
                  <td className="px-3 py-2 text-ocean-sand">{index + 1}</td>
                  <td className="px-3 py-2 font-semibold">
                    {row.symbol}
                    <div className="text-[10px] font-normal text-ocean-sand">
                      {stockMove(row, target)}
                    </div>
                    {row.note ? (
                      <div className="mt-0.5 max-w-[14rem] text-[10px] font-normal text-ocean-sand/80">
                        {row.note}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{fmtPct(target === 1 ? row.bestPct : row.bestPct2)}</div>
                    <div className="text-[10px] text-ocean-sand">
                      {(target === 1 ? row.bestAngleDeg : row.bestAngleDeg2) != null
                        ? fmtDeg(target === 1 ? row.bestAngleDeg : row.bestAngleDeg2)
                        : "—"}
                      {(target === 1 ? row.bestTimeframe : row.bestTimeframe2)
                        ? ` · ${target === 1 ? row.bestTimeframe : row.bestTimeframe2}`
                        : ""}
                      {(target === 1 ? row.bestEarning : row.bestEarning2) != null
                        ? ` · ${fmtMoney(target === 1 ? row.bestEarning : row.bestEarning2)}`
                        : ""}
                    </div>
                  </td>
                  {TIMEFRAMES.map((timeframe) => (
                    <td key={timeframe} className="px-3 py-2">
                      <div className="grid gap-1.5">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-ocean-sand/70">Relative</div>
                          <MetricLines row={metric(target === 1 ? row.profile : row.profile2, timeframe, "angl")} />
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-ocean-sand/70">Separation</div>
                          <MetricLines row={metric(target === 1 ? row.profile : row.profile2, timeframe, "sep")} />
                        </div>
                        <div className="text-[10px] text-ocean-sand/80">
                          {historyLine(target === 1 ? row.profile : row.profile2, timeframe) ?? "No history yet"}
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
