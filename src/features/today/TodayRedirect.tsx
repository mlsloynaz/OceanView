import { Navigate } from "react-router-dom";
import { defaultTodayMode, todayPath } from "./lib/today-routes";

export function TodayRedirect() {
  return <Navigate to={todayPath(defaultTodayMode())} replace />;
}
