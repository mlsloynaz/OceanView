import { Navigate } from "react-router-dom";
import { alarmsPath, defaultAlarmsTab } from "./lib/alarm-routes";

/** `/alarms` → strategy confirms tab. */
export function AlarmsRedirect() {
  return <Navigate to={alarmsPath(defaultAlarmsTab())} replace />;
}
