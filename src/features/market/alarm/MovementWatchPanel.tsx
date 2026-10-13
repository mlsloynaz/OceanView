import { cn } from "@/shared/lib/cn";
import type { MovementWatchJobStatus } from "./movement-watch-job";

function statusTone(status: string): string {
  if (status === "running") return "border-amber-500/40 bg-amber-500/10";
  if (status === "cancelled") return "border-ocean-danger/40 bg-ocean-danger/5";
  return "border-ocean-mid/40 bg-ocean-surface/60";
}

type Props = {
  job: MovementWatchJobStatus | null;
};

/** Read-only status on Alarms — start/stop lives on Admin → Job Status. */
export function MovementWatchPanel({ job }: Props) {
  const jobStatus = job?.status ?? "idle";
  const running = jobStatus === "running";
  const symbols = job?.symbols?.length ? job.symbols : [];
  const ruleKeys = job?.ruleKeys?.length ? job.ruleKeys : [];

  return (
    <section
      className="space-y-2 rounded-xl border border-ocean-mid/50 bg-ocean-deep/30 p-3"
      aria-label="Movement Watch"
    >
      <div>
        <h3 className="text-sm font-semibold text-ocean-foam">Movement Watch</h3>
        <p className="mt-0.5 text-[11px] text-ocean-sand">
          Active tickers × active-movements. Start and stop from{" "}
          <span className="font-medium text-ocean-foam">Admin → Job Status</span>. Keep
          OceanView open while running so watches can poll.
        </p>
      </div>
      <div className={cn("space-y-2 rounded-lg border px-3 py-2.5", statusTone(jobStatus))}>
        <p className="text-[11px] text-ocean-sand">
          Status: <span className="capitalize text-ocean-foam">{jobStatus}</span>
          {typeof job?.activeTickerCount === "number"
            ? ` · ${job.activeTickerCount} active tickers`
            : ""}
        </p>
        <p className="font-mono text-xs text-ocean-foam">
          {running && symbols.length > 0
            ? `${symbols.length} symbols · ${ruleKeys.join(", ") || "no movements"}`
            : ruleKeys.length > 0
              ? `Idle · movements: ${ruleKeys.join(", ")}`
              : "Idle — start from Admin"}
        </p>
        {job?.message ? (
          <p className="text-[11px] leading-snug text-ocean-sand">{job.message}</p>
        ) : null}
      </div>
    </section>
  );
}
