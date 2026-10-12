import { useCallback, useEffect, useState } from "react";
import { cn } from "@/shared/lib/cn";
import {
  fetchOrb5mAutoJobStatus,
  fetchOrbAutoJobStatus,
  stopOrb5mAutoJobAws,
  stopOrbAutoJob,
  type OrbAutoJobStatus,
} from "./alarm-client";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type Row = {
  id: "orb5m" | "orb15";
  movement: string;
  frequency: string;
  tickers: string[];
};

function formatFrequency(seconds: number | undefined): string {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value % 60 === 0) {
    const minutes = value / 60;
    return minutes === 1 ? "every 1 min" : `every ${minutes} min`;
  }
  return `every ${value}s`;
}

function rowFromJob(id: Row["id"], movement: string, job: OrbAutoJobStatus | null): Row | null {
  if (!job || String(job.status).toLowerCase() !== "running") return null;
  const tickers = (job.symbols ?? [])
    .map((symbol) => String(symbol).trim().toUpperCase())
    .filter(Boolean);
  return {
    id,
    movement,
    frequency: formatFrequency(job.pollIntervalSeconds),
    tickers,
  };
}

type Props = {
  onStopped15m?: () => void;
  onStopped5m?: () => void;
};

export function AwsRunningMovements({ onStopped15m, onStopped5m }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stopping, setStopping] = useState<Row["id"] | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [orb5m, orb15] = await Promise.all([
        fetchOrb5mAutoJobStatus(),
        fetchOrbAutoJobStatus(),
      ]);
      const next = [
        rowFromJob("orb5m", "5m ORB", orb5m),
        rowFromJob("orb15", "15m ORB", orb15),
      ].filter((row): row is Row => row !== null);
      setRows(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read AWS movement jobs.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const stop = async (id: Row["id"]) => {
    setStopping(id);
    try {
      if (id === "orb5m") {
        await stopOrb5mAutoJobAws("cancelled");
        onStopped5m?.();
      } else {
        await stopOrbAutoJob("cancelled");
        onStopped15m?.();
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stop failed.");
    } finally {
      setStopping(null);
    }
  };

  return (
    <section
      className="space-y-2 rounded-xl border border-ocean-mid/50 bg-ocean-deep/30 p-3"
      aria-label="Movements running in AWS"
    >
      <div>
        <h3 className="text-sm font-semibold text-ocean-foam">
          {rows.length} movement{rows.length === 1 ? "" : "s"} running in AWS
        </h3>
        <p className="mt-0.5 text-[11px] text-ocean-sand">
          Live job status. Stop ends that job so AWS stops checking those tickers.
        </p>
      </div>
      {error ? <p className="text-[11px] text-ocean-danger">{error}</p> : null}
      {rows.length === 0 ? (
        <p className="text-xs text-ocean-sand">No movement job is running in AWS.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ocean-foam">
                  {row.movement}
                  <span className="ml-2 font-normal text-ocean-sand">{row.frequency}</span>
                </p>
                <p className="mt-0.5 font-mono text-xs text-ocean-foam">
                  {row.tickers.length > 0 ? row.tickers.join(", ") : "No tickers"}
                </p>
              </div>
              <button
                type="button"
                className={cn(BTN, "border border-ocean-mid/40 text-ocean-sand")}
                disabled={stopping !== null}
                onClick={() => void stop(row.id)}
              >
                {stopping === row.id ? "…" : "Stop"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
