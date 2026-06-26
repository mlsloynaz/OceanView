import { Navigate } from "react-router-dom";
import { defaultMarketMode, marketPath } from "./lib/market-routes";

/** `/market` → last-used mode from localStorage (default strategies). */
export function MarketRedirect() {
  return <Navigate to={marketPath(defaultMarketMode())} replace />;
}
