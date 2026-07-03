import { CandlesPane } from "./candles/CandlesPane";
import { SetupScanPane } from "./setup-scan/SetupScanPane";
import { StrategiesPane } from "./strategies/StrategiesPane";
import { TickersPane } from "./tickers/TickersPane";

export function AdminPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ocean-foam">Admin</h1>
        <p className="mt-2 text-ocean-sand">
          Operations and configuration for tickers, candles, and dynamic strategies.{" "}
          <a href="#admin-setup-scan-pane" className="text-ocean-teal hover:underline">
            Setup scan
          </a>{" "}
          (preselection) ranks the full catalog — activate tickers from there before live evaluate.
        </p>
      </div>

      <SetupScanPane />
      <TickersPane />
      <CandlesPane />
      <StrategiesPane />
    </div>
  );
}
