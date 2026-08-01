import { Link } from "react-router-dom";
import { StrategiesPane } from "@/features/admin/strategies/StrategiesPane";

/**
 * Strategies hub — single place for strategy administration.
 * Compatibility: /admin#admin-strategies-pane, /strategies/new, /strategies/:id/edit
 */
export function StrategiesHubPage() {
  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ocean-foam sm:text-4xl">
          Strategies
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-ocean-sand">
          Catalog, builder, and activation. Builder shortcuts:{" "}
          <Link to="/strategies/new" className="text-ocean-teal hover:underline">
            New strategy
          </Link>
          . Legacy Admin entry:{" "}
          <Link to="/admin#admin-strategies-pane" className="text-ocean-teal hover:underline">
            Admin → Strategies
          </Link>
          .
        </p>
      </div>
      <StrategiesPane />
    </div>
  );
}
