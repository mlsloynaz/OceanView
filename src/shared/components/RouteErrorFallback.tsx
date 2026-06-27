import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";
import { defaultMarketMode, marketPath } from "@/features/market/lib/market-routes";

export function RouteErrorFallback() {
  const error = useRouteError();
  const home = marketPath(defaultMarketMode());

  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading this page.";

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Page not found" : `Error ${error.status}`;
    message = error.statusText || message;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 py-8 text-center">
      <h1 className="font-display text-2xl font-semibold text-ocean-foam">{title}</h1>
      <p className="text-sm text-ocean-sand">{message}</p>
      <Link
        to={home}
        className="inline-block rounded-md bg-ocean-teal px-4 py-2 text-sm font-semibold text-ocean-deep hover:brightness-105"
      >
        Go to Market
      </Link>
    </div>
  );
}
