import { cn } from "@/shared/lib/cn";
import type { Orb5mAutoJobStatus } from "./orb5m-auto-job";
import { isOrb5mWindowOpen, orb5mWindowMessage } from "./orb-window";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

function statusTone(status: string): string {
  if (status === "running") return "border-amber-500/40 bg-amber-500/10";
  if (status === "cancelled") return "border-ocean-danger/40 bg-ocean-danger/5";
  return "border-ocean-mid/40 bg-ocean-surface/60";
}

type Props = {
  nowTick: Date;
  timeMode: "live" | "simulate";
  favoriteSymbols: string[];
  orb5mAutoJob: Orb5mAutoJobStatus | null;
  busy5m?: boolean;
  onStart5m: (symbols: string[]) => void;
  onCancel5m: () => void;
};

export function OrbMonitorPanel({
  nowTick,
  timeMode,
  favoriteSymbols,
  orb5mAutoJob,
  busy5m,
  onStart5m,
  onCancel5m,
}: Props) {
  const open5 = isOrb5mWindowOpen(nowTick);
  const jobStatus = orb5mAutoJob?.status ?? "idle";
  const running = jobStatus === "running";
  const cancelledToday = jobStatus === "cancelled";
  const shown =
    running && orb5mAutoJob?.symbols?.length
      ? orb5mAutoJob.symbols
      : favoriteSymbols;
  const canStart =
    open5 && !running && !cancelledToday && !busy5m && favoriteSymbols.length > 0;
  const windowMessage = orb5mWindowMessage(nowTick);

  return (
    <section
      className="space-y-2 rounded-xl border border-ocean-mid/50 bg-ocean-deep/30 p-3"
      aria-label="ORB monitor"
    >
      <div>
        <h3 className="text-sm font-semibold text-ocean-foam">5m ORB Auto</h3>
        <p className="mt-0.5 text-[11px] text-ocean-sand">
          Checks every favorite ticker, 9:35–11:30 AM ET. Popup and sound only on{" "}
          <span className="font-medium text-ocean-foam">Entry</span>. Keep OceanView open.
          Stop on a card pauses that ticker for the rest of the session.
          {timeMode !== "live" ? " Switch to Live to auto-start." : ""}
        </p>
      </div>
      <div className={cn("space-y-2 rounded-lg border px-3 py-2.5", statusTone(jobStatus))}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[11px] text-ocean-sand">
              9:35–11:30 AM ET
              {" · "}
              <span className="capitalize text-ocean-foam">{jobStatus}</span>
              {cancelledToday ? " today" : ""}
            </p>
            <p className="mt-1 font-mono text-xs text-ocean-foam">
              {shown.length > 0 ? shown.join(", ") : "No favorite tickers"}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={cn(BTN, "bg-ocean-teal text-ocean-deep")}
              disabled={!canStart}
              onClick={() => onStart5m(favoriteSymbols)}
            >
              {busy5m ? "…" : "Start"}
            </button>
            <button
              type="button"
              className={cn(BTN, "border border-ocean-mid/40 text-ocean-sand")}
              disabled={!running || busy5m}
              onClick={onCancel5m}
            >
              Cancel
            </button>
          </div>
        </div>
        <p className="text-[11px] leading-snug text-ocean-sand">
          {favoriteSymbols.length === 0
            ? "Mark tickers as favorites and the auto check uses that list."
            : open5
              ? "Watches appear on the Kanban. Alarm on Entry only."
              : (windowMessage ?? "Waiting for the 5m ORB window.")}
          {cancelledToday
            ? " Cancelled for today — add a manual watch or wait until tomorrow."
            : ""}
        </p>
      </div>
    </section>
  );
}
