import { cn } from "@/shared/lib/cn";
import type { EmaCrossBucket, EmaCrossFrame, TrendProfileResponse, TrendProfileRow } from "./types";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

function fmtPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function fmtAngle(frame: EmaCrossFrame | null | undefined): string {
  if (!frame || frame.ang == null) return frame?.angLabel ?? "—";
  return `${frame.ang}°`;
}

function fmtGap(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value < 1 ? `${Math.round(value * 100)}¢` : `$${value.toFixed(2)}`;
}

function fmtSep(frame: EmaCrossFrame | null | undefined): string {
  if (!frame || frame.sep == null) return frame?.sepLabel ?? "—";
  return fmtGap(frame.sep);
}

function filled(buckets: EmaCrossBucket[] | null | undefined): EmaCrossBucket[] {
  return (buckets ?? []).filter((row) => row.count > 0);
}

function BucketList({
  title,
  buckets,
  winner,
}: {
  title: string;
  buckets: EmaCrossBucket[];
  winner?: string | null;
}) {
  if (buckets.length === 0) {
    return <p className="text-[11px] text-ocean-sand">No {title.toLowerCase()} yet.</p>;
  }
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wide text-ocean-sand">{title}</div>
      <ul className="space-y-0.5">
        {buckets.map((row) => {
          const best = row.label === winner;
          return (
            <li
              key={row.label}
              className={cn("flex justify-between gap-3 tabular-nums", best && "font-semibold text-ocean-foam")}
            >
              <span>
                {row.label}
                {best ? " best" : ""}
              </span>
              <span>
                {fmtPct(row.pct)} · {row.hits}/{row.count}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FrameCard({ label, frame }: { label: string; frame: EmaCrossFrame | null | undefined }) {
  return (
    <div className="rounded-md border border-ocean-mid/30 p-3">
      <div className="text-xs font-semibold text-ocean-foam">{label}</div>
      <p className="mt-1 text-[11px] text-ocean-sand">
        Angle {fmtAngle(frame)}
        {frame?.angLabel ? ` (${frame.angLabel})` : ""} · {fmtPct(frame?.angPct)}
        {" · "}
        Separation {fmtSep(frame)}
        {frame?.sepLabel ? ` (${frame.sepLabel})` : ""} · {fmtPct(frame?.sepPct)}
      </p>
      <p className="mt-0.5 text-[11px] text-ocean-sand">
        {frame?.crosses ?? 0} crosses · {fmtPct(frame?.followedPct)} followed $1
      </p>
      <p className="mt-0.5 text-[11px] text-ocean-sand">
        $2 angle {frame?.ang2 == null ? "—" : `${frame.ang2}°`}
        {frame?.ang2Label ? ` (${frame.ang2Label})` : ""} · {fmtPct(frame?.ang2Pct)}
        {" · "}
        $2 separation {fmtGap(frame?.sep2)}
        {frame?.sep2Label ? ` (${frame.sep2Label})` : ""} · {fmtPct(frame?.sep2Pct)}
      </p>
      <p className="mt-0.5 text-[11px] text-ocean-sand">
        $1 most often {frame?.time1Label ?? "—"} ({fmtPct(frame?.time1Pct)})
      </p>
      <p className="mt-0.5 text-[11px] text-ocean-sand">
        $2 most often {frame?.time2Label ?? "—"} ({fmtPct(frame?.time2Pct)})
      </p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <BucketList title="Angle" buckets={filled(frame?.angle)} winner={frame?.angLabel} />
        <BucketList title="Separation" buckets={filled(frame?.separation)} winner={frame?.sepLabel} />
      </div>
    </div>
  );
}

function TickerBlock({ row }: { row: TrendProfileRow }) {
  return (
    <section className="rounded-md border border-ocean-mid/40 p-3">
      <h4 className="text-sm font-semibold text-ocean-foam">{row.symbol}</h4>
      {row.note ? <p className="mt-1 text-[11px] text-ocean-sand">{row.note}</p> : null}
      <p className="mt-1 text-[11px] text-ocean-sand">
        Reversal {row.profile?.["1m-reversal-angl"] == null ? "—" : `${row.profile["1m-reversal-angl"]}°`}
        {" · "}
        cross {row.profile?.["1m-reversal-cross"] == null ? "—" : `${row.profile["1m-reversal-cross"]} min`}
        {" · "}
        {fmtGap(row.profile?.["1m-reversal-distance"])} from EMA 10
      </p>
      <div className="mt-2 grid gap-3 lg:grid-cols-2">
        <FrameCard label="1m" frame={row.m1} />
        <FrameCard label="5m" frame={row.m5} />
      </div>
    </section>
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
  const ranked = data?.ranked ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h3 className="text-sm font-semibold text-ocean-foam">1m ema cross study</h3>
          <p className="mt-1 text-xs leading-relaxed text-ocean-sand">
            After EMA 10 crosses EMA 21, this counts how often price then moves at least $1 with the
            cross, within 30 minutes and before the averages cross back. A call uses the high. A put
            uses the low. Angle and separation are scored separately. The highlighted bucket is
            the one with the stronger 95% Wilson lower bound. The percentage shown is how many
            of its crosses reached $1. The same ranking also picks an angle and a separation for a
            $2 follow. For the crosses that reach $1, and again for the crosses that reach $2, the
            card shows the time that occurs most often. The same
            study runs on about one month of 1-minute and 5-minute bars. Alarms are unchanged.
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
            title="Deletes every saved profile, then calculates again"
            className={cn(BTN, "border border-ocean-danger/50 text-ocean-danger hover:bg-ocean-danger/10")}
          >
            Recalculate
          </button>
        </div>
      </div>

      {error ? <p className="text-xs text-ocean-danger">{error}</p> : null}
      {data?.message ? <p className="text-xs text-ocean-sand/90">{data.message}</p> : null}

      {ranked.length === 0 ? (
        <p className="text-xs text-ocean-sand">
          {loading ? "Loading profiles…" : calculating ? "Calculating…" : "No calculated profiles yet."}
        </p>
      ) : (
        <div className="space-y-3">
          {ranked.map((row) => (
            <TickerBlock key={row.symbol} row={row} />
          ))}
        </div>
      )}

      {data?.missing?.length ? (
        <p className="text-[11px] text-ocean-sand/80">Not calculated yet: {data.missing.join(", ")}</p>
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
