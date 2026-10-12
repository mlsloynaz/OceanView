import { useCallback, useEffect, useState } from "react";
import { cn } from "@/shared/lib/cn";
import {
  fetchOrb5mAutoJobStatus,
  stopOrb5mAutoJobAws,
  type OrbAutoJobStatus,
} from "./alarm-client";
import type { MarketAlarmWatch } from "./alarm-types";
import { charlesCallLabel, formatSchwabInterval } from "./schwab-refresh";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type Row = {
  id: "orb5m";
  movement: string;
  frequency: string;
  tickers: string[];
};

function rowFromJob(
  id: Row["id"],
  movement: string,
  job: OrbAutoJobStatus | null,
  watches: MarketAlarmWatch[],
): Row | null {
  if (!job || String(job.status).toLowerCase() !== "running") return null;
  const tickers = (job.symbols ?? [])
    .map((symbol) => String(symbol).trim().toUpperCase())
    .filter(Boolean);
  return {
    id,
    movement,
    frequency: charlesFrequency(tickers, watches, job.pollIntervalSeconds),
    tickers,
  };
}

function charlesFrequency(tickers: string[], watches: MarketAlarmWatch[], fallbackSeconds: number | undefined): string {
  const labels = tickers.map((ticker) => {
    const fromWatches = charlesCallLabel(watches, ticker);
    const fallback = Number(fallbackSeconds);
    const label =
      fromWatches ??
      (Number.isFinite(fallback) && fallback > 0 ? formatSchwabInterval(fallback * 1000) : null);
    return label ? `${ticker} ${label}` : null;
  }).filter((label): label is string => Boolean(label));
  if (labels.length === 0) {
    return formatSchwabInterval((fallbackSeconds && fallbackSeconds > 0 ? fallbackSeconds : 60) * 1000);
  }
  const rates = new Set(labels.map((label) => label.slice(label.indexOf(" ") + 1)));
  if (rates.size === 1) return [...rates][0]!;
  return labels.join(" · ");
}

type Props = {
  watches: MarketAlarmWatch[];
  onStopped5m?: () => void;
};

export function AwsRunningMovements({ watches, onStopped5m }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stopping, setStopping] = useState<Row["id"] | null>(null);

  const refresh = useCallback(async () => {
    try {
      const orb5m = await fetchOrb5mAutoJobStatus();
      const next = [rowFromJob("orb5m", "5m ORB", orb5m, watches)].filter(
        (row): row is Row => row !== null,
      );
      setRows(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read AWS movement jobs.");
    }
  }, [watches]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const stop = async (id: Row["id"]) => {
    setStopping(id);
    try {
      await stopOrb5mAutoJobAws("cancelled");
      onStopped5m?.();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stop failed.");
    } finally {
      setStopping(null);
    }
  };

  return (
    <section
      className="overflow-hidden rounded-xl border border-ocean-mid/50 bg-ocean-deep/30"
      aria-label="Movements running in AWS"
    >
      <div className="border-b border-ocean-mid/30 px-3 py-2">
        <h3 className="text-sm font-semibold text-ocean-foam">
          {rows.length} movement{rows.length === 1 ? "" : "s"} running
        </h3>
      </div>
      {error ? <p className="px-3 py-2 text-[11px] text-ocean-danger">{error}</p> : null}
      <table className="w-full text-left text-xs">
        <thead className="text-[11px] uppercase tracking-wide text-ocean-sand">
          <tr>
            <th className="px-3 py-2 font-medium">Movement</th>
            <th className="px-3 py-2 font-medium">Freq</th>
            <th className="px-3 py-2 font-medium">Tickers</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-3 text-ocean-sand" colSpan={4}>
                No movement is running.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-t border-ocean-mid/25">
                <td className="px-3 py-2 font-semibold text-ocean-foam">{row.movement}</td>
                <td className="px-3 py-2 text-ocean-sand">{row.frequency}</td>
                <td className="px-3 py-2 font-mono text-ocean-foam">
                  {row.tickers.length > 0 ? row.tickers.join(", ") : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className={cn(BTN, "border border-ocean-mid/40 text-ocean-sand")}
                    disabled={stopping !== null}
                    onClick={() => void stop(row.id)}
                  >
                    {stopping === row.id ? "…" : "Stop"}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
