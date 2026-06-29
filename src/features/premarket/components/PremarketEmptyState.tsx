type Props = {
  threshold: number;
};

export function PremarketEmptyState({ threshold }: Props) {
  return (
    <div className="rounded-xl border border-dashed border-ocean-mid/50 bg-ocean-surface/50 px-6 py-10 text-center">
      <p className="font-display text-lg text-ocean-foam">No premarket run yet</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ocean-sand">
        Click <strong className="text-ocean-teal-dim dark:text-ocean-teal">Start evaluate</strong> for
        a pre-open scan at <strong>9:25 AM ET</strong>. Active tickers are scored against active
        strategies; results list symbols with quality ≥ {threshold}%.
      </p>
      <p className="mx-auto mt-3 max-w-md text-xs text-ocean-sand/80">
        Ensure Admin candles are loaded for active tickers first. This run does not update stored
        candles.
      </p>
    </div>
  );
}
