import { cn } from "@/shared/lib/cn";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  canStart: boolean;
  canStop: boolean;
  running: boolean;
  startPending: boolean;
  stopPending: boolean;
  tickerCount: number;
  moveCapPct: number;
  polledAt?: string | null;
  error?: string | null;
  onStart: () => void;
  onStop: () => void;
};

function formatPolledAt(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "shortGeneric",
    });
  } catch {
    return iso;
  }
}

export function PremarketBestResultMonitorBar({
  canStart,
  canStop,
  running,
  startPending,
  stopPending,
  tickerCount,
  moveCapPct,
  polledAt,
  error,
  onStart,
  onStop,
}: Props) {
  return (
    <div className="rounded-lg border border-ocean-mid/40 bg-ocean-surface px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ocean-sand">
          Best strikes
        </span>
        <button
          type="button"
          className={cn(BTN, "bg-ocean-teal text-ocean-deep hover:brightness-110")}
          disabled={!canStart}
          onClick={onStart}
        >
          {startPending ? "Starting…" : "Start best strikes"}
        </button>
        <button
          type="button"
          className={cn(BTN, "border border-ocean-danger/50 text-ocean-danger hover:bg-ocean-danger/10")}
          disabled={!canStop}
          onClick={onStop}
        >
          {stopPending ? "Stopping…" : "Stop"}
        </button>
        <span className="text-xs text-ocean-sand">
          {running
            ? `Monitoring ${tickerCount} ticker${tickerCount === 1 ? "" : "s"} · last scan ${formatPolledAt(polledAt)} · move cap ${moveCapPct}%`
            : `Idle · move cap ${moveCapPct}% · needs Best results from evaluate`}
        </span>
      </div>
      {error ? (
        <p className="text-xs text-ocean-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
