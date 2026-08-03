import { useEffect, useState } from "react";
import { fetchMarketContext } from "@/features/market/api/market-client";
import type { MarketContextItem, MarketContextKey, MarketContextLean } from "@/features/market/types";

const CONTEXT_KEYS: MarketContextKey[] = ["SPY", "QQQ", "IWM", "VIX", "Breadth"];

const PLACEHOLDER_ROWS: MarketContextItem[] = CONTEXT_KEYS.map((key) => ({
  key,
  lean: null,
  label: "—",
}));

function leanClassName(lean: MarketContextLean | null): string {
  if (lean === "bullish") return "text-emerald-400";
  if (lean === "bearish") return "text-rose-400";
  return "text-ocean-sand";
}

export function MarketContextStrip() {
  const [rows, setRows] = useState<MarketContextItem[]>(PLACEHOLDER_ROWS);

  useEffect(() => {
    let cancelled = false;
    void fetchMarketContext()
      .then((payload) => {
        if (cancelled) return;
        const byKey = new Map(payload.items.map((item) => [item.key, item]));
        setRows(
          CONTEXT_KEYS.map(
            (key) => byKey.get(key) ?? { key, lean: null, label: "—" },
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setRows(PLACEHOLDER_ROWS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
        <p className="text-xs text-ocean-sand/70">Market Lean — informational only</p>
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {rows.map((row) => (
          <li key={row.key} className="flex items-baseline gap-2 text-sm" title={row.evidence}>
            <span className="font-semibold text-ocean-foam">{row.key}</span>
            <span className={leanClassName(row.lean)}>{row.label || "—"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
