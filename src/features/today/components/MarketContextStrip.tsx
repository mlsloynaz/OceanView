/**
 * Compact market-context placeholder for Phase 1.
 * Direction sources stay internal; user-facing label is Market Lean later.
 */
const CONTEXT_ROWS = [
  { symbol: "SPY", lean: "—" },
  { symbol: "QQQ", lean: "—" },
  { symbol: "IWM", lean: "—" },
  { symbol: "VIX", lean: "—" },
  { symbol: "Breadth", lean: "—" },
] as const;

export function MarketContextStrip() {
  return (
    <section
      aria-labelledby="today-market-context-heading"
      className="rounded-xl border border-ocean-mid/50 bg-ocean-surface/80 px-4 py-3"
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="today-market-context-heading"
          className="text-xs font-bold uppercase tracking-wider text-ocean-teal"
        >
          Market Context
        </h2>
        <p className="text-xs text-ocean-sand/70">
          Market Lean — informational only (live lean wiring comes next)
        </p>
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {CONTEXT_ROWS.map((row) => (
          <li key={row.symbol} className="flex items-baseline gap-2 text-sm">
            <span className="font-semibold text-ocean-foam">{row.symbol}</span>
            <span className="text-ocean-sand">{row.lean}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
