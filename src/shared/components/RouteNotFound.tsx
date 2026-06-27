import { Link, useLocation } from "react-router-dom";
import { defaultMarketMode, marketPath } from "@/features/market/lib/market-routes";

export function RouteNotFound() {
  const { pathname } = useLocation();
  const home = marketPath(defaultMarketMode());

  return (
    <div className="mx-auto max-w-lg space-y-4 py-8 text-center">
      <h1 className="font-display text-2xl font-semibold text-ocean-foam">Page not found</h1>
      <p className="text-sm text-ocean-sand">
        No route matches <span className="font-mono text-ocean-foam">{pathname}</span>.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to={home}
          className="rounded-md bg-ocean-teal px-4 py-2 text-sm font-semibold text-ocean-deep hover:brightness-105"
        >
          Go to Market
        </Link>
        <Link
          to="/admin"
          className="rounded-md border border-ocean-mid/60 px-4 py-2 text-sm font-medium text-ocean-sand hover:border-ocean-teal/50 hover:text-ocean-foam"
        >
          Admin
        </Link>
      </div>
    </div>
  );
}
