type Props = {
  strategyCount: number;
  activeSignals: number;
  tickerCount: number;
  ruleCount?: number;
  assessmentLabel?: string;
};

export function MarketSummaryStrip({
  strategyCount,
  activeSignals,
  tickerCount,
  ruleCount,
  assessmentLabel,
}: Props) {
  return (
    <p className="text-[11px] text-ocean-sand/80 tabular-nums">
      <span>{strategyCount} strategies</span>
      <span className="mx-1.5 text-ocean-mid">·</span>
      <span className="text-ocean-teal-dim dark:text-ocean-teal">{activeSignals} signals</span>
      <span className="mx-1.5 text-ocean-mid">·</span>
      <span>{tickerCount} tickers</span>
      {ruleCount != null && (
        <>
          <span className="mx-1.5 text-ocean-mid">·</span>
          <span>{ruleCount} rules</span>
        </>
      )}
      {assessmentLabel && (
        <>
          <span className="mx-1.5 text-ocean-mid">·</span>
          <span className="text-ocean-sand/60">{assessmentLabel}</span>
        </>
      )}
    </p>
  );
}
