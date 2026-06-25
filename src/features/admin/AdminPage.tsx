import { CandlesPane } from "./candles/CandlesPane";

export function AdminPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ocean-foam">Admin</h1>
        <p className="mt-2 text-ocean-sand">
          Operations and configuration for market data intake.
        </p>
      </div>

      <CandlesPane />
    </div>
  );
}
