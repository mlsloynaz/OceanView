import { Link } from "react-router-dom";
import { useAlarms } from "@/features/alarms/AlarmsProvider";
import { alarmsPath } from "@/features/alarms/lib/alarm-routes";
import { TodaySection } from "./TodaySection";

export function ActiveWatchesSection() {
  const alarms = useAlarms();
  const running = alarms.runningCount;
  const met = alarms.metCount;

  return (
    <TodaySection
      id="today-active-watches"
      title="Alarms"
      subtitle="Monitoring moved off Live — open the Alarms page for strategy confirms and breakout watches"
      actions={
        <Link
          to={alarmsPath("strategy")}
          className="rounded-md bg-ocean-teal px-3 py-1.5 text-xs font-semibold text-ocean-deep hover:brightness-110"
        >
          Open Alarms
        </Link>
      }
    >
      <p className="text-sm text-ocean-sand">
        {running > 0
          ? `${running} watch${running === 1 ? "" : "es"} polling`
          : "No watches polling"}
        {met > 0 ? ` · ${met} in enter/exit cycle` : ""}
        {". "}
        <Link to={alarmsPath("strategy")} className="text-ocean-teal hover:underline">
          Strategy confirms
        </Link>
        {" · "}
        <Link to={alarmsPath("movement")} className="text-ocean-teal hover:underline">
          Movement / Breakout
        </Link>
      </p>
    </TodaySection>
  );
}
