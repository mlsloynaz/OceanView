import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authRequired, username, loading } = useAuth();
  const location = useLocation();

  if (!authRequired) {
    return children;
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-ocean-deep text-ocean-sand">
        <p className="text-sm tracking-wide">Loading session…</p>
      </div>
    );
  }

  if (!username) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
