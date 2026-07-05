import { Navigate } from "react-router-dom";
import { defaultMarketMode, marketPath } from "@/features/market/lib/market-routes";
import { useAuth } from "./AuthProvider";

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { authRequired, isAdmin, loading } = useAuth();

  if (!authRequired || isAdmin) {
    return children;
  }

  if (loading) {
    return null;
  }

  return <Navigate to={marketPath(defaultMarketMode())} replace />;
}
