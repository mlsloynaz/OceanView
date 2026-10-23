import { Navigate } from "react-router-dom";
import { alarmsPath, defaultAlarmsTab } from "./lib/alarm-routes";

/** `/alarms` → Movement / Breakout tab. */
export function AlarmsRedirect() {
  return <Navigate to={alarmsPath(defaultAlarmsTab())} replace />;
}
