import { Link } from "react-router-dom";
import { SetupScanPane } from "@/features/admin/setup-scan/SetupScanPane";
import { TickersPane } from "@/features/admin/tickers/TickersPane";

/**
 * Universe hub — instruments OceanView studies.
 * Includes ticker catalog (watchlist / best-fit / tradable / movement) and SemiFinal preselection.
 * Compatibility: /admin#admin-tickers-pane, /admin#admin-setup-scan-pane
 */
export function UniversePage() {
  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ocean-foam sm:text-4xl">
          Universe
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-ocean-sand">
          Ticker catalog, best-fit, tradability, movement profiles, and SemiFinal preselection.
          Legacy Admin entries remain under{" "}
          <Link to="/admin" className="text-ocean-teal hover:underline">
            Admin
          </Link>
          .
        </p>
      </div>

      <TickersPane />

      <section aria-labelledby="universe-semifinal-heading" className="space-y-3">
        <div>
          <h2
            id="universe-semifinal-heading"
            className="font-display text-xl font-semibold text-ocean-foam"
          >
            SemiFinal preselection
          </h2>
          <p className="mt-1 text-sm text-ocean-sand">
            Day-setup fitness for activating the live universe — same pane as Admin → Tickers
            SemiFinal.
          </p>
        </div>
        <SetupScanPane />
      </section>
    </div>
  );
}
