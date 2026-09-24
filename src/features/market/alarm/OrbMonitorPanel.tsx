import { useEffect, useState } from "react";
import { cn } from "@/shared/lib/cn";
import type { OrbAutoJobStatus } from "./alarm-client";
import type { Orb5mAutoJobStatus } from "./orb5m-auto-job";
import { parseOrbSymbolList } from "./orb5m-auto-job";
import {
  DEFAULT_ORB_AUTO_SYMBOLS,
  isOrb5mWindowOpen,
  isOrbWindowOpen,
  orb5mWindowMessage,
  orbWindowMessage,
} from "./orb-window";

const BTN =
  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

function statusTone(status: string): string {
  if (status === "running") return "border-amber-500/40 bg-amber-500/10";
  if (status === "cancelled") return "border-ocean-danger/40 bg-ocean-danger/5";
  return "border-ocean-mid/40 bg-ocean-surface/60";
}

function OrbLane({
  title,
  windowLabel,
  hint,
  jobStatus,
  windowOpen,
  windowMessage,
  cancelledToday,
  defaultSymbols,
  busy,
  onStart,
  onCancel,
}: {
  title: string;
  windowLabel: string;
  hint: string;
  jobStatus: string;
  windowOpen: boolean;
  windowMessage: string | null;
  cancelledToday: boolean;
  defaultSymbols: string[];
  busy: boolean;
  onStart: (symbols: string[]) => void;
  onCancel: () => void;
}) {
  const [raw, setRaw] = useState(defaultSymbols.join(", "));
  useEffect(() => {
    setRaw(defaultSymbols.join(", "));
  }, [defaultSymbols.join(",")]);

  const running = jobStatus === "running";
  const canStart = windowOpen && !running && !cancelledToday && !busy;

  return (
    <div className={cn("space-y-2 rounded-lg border px-3 py-2.5", statusTone(jobStatus))}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ocean-foam">{title}</p>
          <p className="mt-0.5 text-[11px] text-ocean-sand">
            {windowLabel}
            {" · "}
            <span className="capitalize text-ocean-foam">{jobStatus}</span>
            {cancelledToday ? " today" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={cn(BTN, "bg-ocean-teal text-ocean-deep")}
            disabled={!canStart}
            onClick={() => onStart(parseOrbSymbolList(raw))}
          >
            {busy ? "…" : "Start"}
          </button>
          <button
            type="button"
            className={cn(BTN, "border border-ocean-mid/40 text-ocean-sand")}
            disabled={!running || busy}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
      <label className="block text-[11px] text-ocean-sand">
        Tickers
        <textarea
          rows={2}
          value={raw}
          onChange={(e) => setRaw(e.target.value.toUpperCase())}
          disabled={running}
          className="mt-1 w-full rounded-md border border-ocean-mid/40 bg-ocean-deep px-2 py-1.5 font-mono text-xs text-ocean-foam disabled:opacity-60"
          placeholder="TSLA, MSFT, SPY"
        />
      </label>
      <p className="text-[11px] leading-snug text-ocean-sand">
        {windowOpen
          ? hint
          : (windowMessage ?? "Waiting for the ORB window.")}
        {cancelledToday ? " Cancelled for today — add a manual watch or wait until tomorrow." : ""}
      </p>
    </div>
  );
}

type Props = {
  nowTick: Date;
  timeMode: "live" | "simulate";
  orbAutoJob: OrbAutoJobStatus | null;
  orb5mAutoJob: Orb5mAutoJobStatus | null;
  busy15m?: boolean;
  busy5m?: boolean;
  onStart15m: (symbols: string[]) => void;
  onCancel15m: () => void;
  onStart5m: (symbols: string[]) => void;
  onCancel5m: () => void;
};

export function OrbMonitorPanel({
  nowTick,
  timeMode,
  orbAutoJob,
  orb5mAutoJob,
  busy15m,
  busy5m,
  onStart15m,
  onCancel15m,
  onStart5m,
  onCancel5m,
}: Props) {
  const open15 = isOrbWindowOpen(nowTick);
  const open5 = isOrb5mWindowOpen(nowTick);
  const symbols15 = orbAutoJob?.symbols?.length
    ? orbAutoJob.symbols
    : [...DEFAULT_ORB_AUTO_SYMBOLS];
  const symbols5 = orb5mAutoJob?.symbols?.length
    ? orb5mAutoJob.symbols
    : [...DEFAULT_ORB_AUTO_SYMBOLS];

  return (
    <section
      className="space-y-2 rounded-xl border border-ocean-mid/50 bg-ocean-deep/30 p-3"
      aria-label="ORB monitor"
    >
      <div>
        <h3 className="text-sm font-semibold text-ocean-foam">ORB monitor</h3>
        <p className="mt-0.5 text-[11px] text-ocean-sand">
          Always visible. Auto starts in Live when the window opens. Popup + sound only on{" "}
          <span className="font-medium text-ocean-foam">Entry</span>. Keep OceanView open.
          {timeMode !== "live" ? " Switch to Live to auto-start." : ""}
        </p>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        <OrbLane
          title="15m ORB Auto"
          windowLabel="9:45–11:30 AM ET"
          hint="Watches appear on the Kanban. Alarm on Entry only."
          jobStatus={orbAutoJob?.status ?? "idle"}
          windowOpen={open15}
          windowMessage={orbWindowMessage(nowTick)}
          cancelledToday={orbAutoJob?.status === "cancelled"}
          defaultSymbols={symbols15}
          busy={Boolean(busy15m)}
          onStart={onStart15m}
          onCancel={onCancel15m}
        />
        <OrbLane
          title="5m ORB Auto"
          windowLabel="9:35–11:30 AM ET"
          hint="Live break can flip; alarm still only on Entry."
          jobStatus={orb5mAutoJob?.status ?? "idle"}
          windowOpen={open5}
          windowMessage={orb5mWindowMessage(nowTick)}
          cancelledToday={orb5mAutoJob?.status === "cancelled"}
          defaultSymbols={symbols5}
          busy={Boolean(busy5m)}
          onStart={onStart5m}
          onCancel={onCancel5m}
        />
      </div>
    </section>
  );
}
