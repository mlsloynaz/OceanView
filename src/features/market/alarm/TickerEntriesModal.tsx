import { useEffect, useState } from "react";
import { MarketDetailModal } from "@/features/market/components/MarketDetailModal";
import { loadAlarmTriggerLog, type AlarmTriggerEntry } from "./alarm-trigger-log";
import { entryClock } from "./five-minute-entry";

type Props = {
  symbol: string;
  onClose: () => void;
};

function operationOf(row: AlarmTriggerEntry): "CALL" | "PUT" | null {
  const side = String(row.side || "").toLowerCase();
  if (side === "alcista") return "CALL";
  if (side === "bajista") return "PUT";
  return null;
}

function estimateOf(row: AlarmTriggerEntry): string | null {
  const blob = `${row.way ?? ""} ${row.evidence ?? ""}`;
  const match =
    blob.match(/estimated option gain\s+([0-9]+(?:\.[0-9]+)?)%/i) ??
    blob.match(/est\. earning\s+([0-9]+(?:\.[0-9]+)?)%/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? `${value.toFixed(2)}%` : null;
}

function entryLine(row: AlarmTriggerEntry): string {
  const operation = operationOf(row);
  const estimate = estimateOf(row);
  const time = entryClock(row.triggeredAt) ?? row.triggeredAt;
  if (!operation) return time;
  return estimate ? `${time} : - ${operation} ${estimate}` : `${time} : - ${operation}`;
}

export function TickerEntriesModal({ symbol, onClose }: Props) {
  const [rows, setRows] = useState<AlarmTriggerEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadAlarmTriggerLog("current")
      .then((loaded) => {
        if (cancelled) return;
        const upper = symbol.trim().toUpperCase();
        const today = (loaded.tradeDate ?? "").slice(0, 10);
        const entries = loaded.entries.filter((row) => {
          if (row.kind !== "enter") return false;
          if (String(row.symbol || "").trim().toUpperCase() !== upper) return false;
          if (!today) return true;
          return (row.tradeDate ?? "").slice(0, 10) === today;
        });
        setRows(entries);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load entries.");
        setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  return (
    <MarketDetailModal
      open
      onClose={onClose}
      title={`${symbol} entries`}
      subtitle="Today"
      className="max-w-md"
    >
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {rows == null ? (
        <p className="text-sm text-ocean-sand">Loading entries…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ocean-sand">No entries today.</p>
      ) : (
        <ul className="max-h-80 space-y-1.5 overflow-y-auto">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded border border-ocean-mid/30 bg-ocean-deep/25 px-2.5 py-1.5 text-sm tabular-nums text-ocean-foam"
              title={row.way}
            >
              {entryLine(row)}
            </li>
          ))}
        </ul>
      )}
    </MarketDetailModal>
  );
}
