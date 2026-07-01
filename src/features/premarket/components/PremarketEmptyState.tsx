type Props = {
  threshold: number;
};

export function PremarketEmptyState({ threshold }: Props) {
  return (
    <div className="rounded-xl border border-dashed border-ocean-mid/50 bg-ocean-surface/50 px-6 py-10 text-center">
      <p className="font-display text-lg text-ocean-foam">No evaluate run yet</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ocean-sand">
        Use the <strong className="text-ocean-teal-dim dark:text-ocean-teal">strategy builder</strong>{" "}
        to compose rules, save a screen, then click{" "}
        <strong className="text-ocean-teal-dim dark:text-ocean-teal">Evaluate selected</strong>.
        Results show tickers with quality ≥ {threshold}%.
      </p>
      <p className="mx-auto mt-3 max-w-md text-xs text-ocean-sand/80">
        Strategies and rules live in Dynamo. This run does not update Admin candles.
      </p>
    </div>
  );
}
