import { cn } from "@/shared/lib/cn";
import type { OperationsTicker, OptionPickResult, OptionPicksResponse } from "../types";

type Props = {
  picks: OptionPicksResponse | null;
  tickers: OperationsTicker[];
  buyingSymbol: string | null;
  disabled?: boolean;
  onBuy: (row: OptionPickResult) => void;
};

function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

export function OptionPicksTable({
  picks,
  tickers,
  buyingSymbol,
  disabled = false,
  onBuy,
}: Props) {
  if (!picks) {
    return (
      <p className="text-base leading-relaxed text-ocean-sand">
        Run <strong className="font-medium text-ocean-foam">Find picks</strong> to see
        nearest-expiration strikes inside each optimal range.
      </p>
    );
  }

  if (picks.results.length === 0) {
    return (
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-base text-amber-900 dark:text-amber-100">
        No results returned for {picks.contractType}.
      </p>
    );
  }

  const bySymbol = new Map(tickers.map((row) => [row.symbol, row]));

  return (
    <div className="space-y-3">
      <p className="text-sm text-ocean-sand">
        {picks.contractType} picks · evaluated{" "}
        {picks.evaluatedAt
          ? new Date(picks.evaluatedAt).toLocaleString("en-US", {
              timeZone: "America/New_York",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZoneName: "shortGeneric",
            })
          : "—"}
      </p>
      <div className="overflow-x-auto rounded-lg border border-ocean-mid/40">
        <table className="min-w-full text-left text-base">
          <thead className="border-b border-ocean-mid/40 bg-ocean-deep/25 text-xs font-semibold uppercase tracking-wide text-ocean-sand">
            <tr>
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Spot</th>
              <th className="px-4 py-3">Range</th>
              <th className="px-4 py-3">Strike</th>
              <th className="px-4 py-3">Exp / DTE</th>
              <th className="px-4 py-3">Bid / Ask</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ocean-mid/30">
            {picks.results.map((row) => {
              const ticker = bySymbol.get(row.symbol);
              const canBuy =
                row.status === "ok" &&
                Boolean(row.pick) &&
                (ticker?.position?.canBuy !== false) &&
                ticker?.position?.status !== "bought" &&
                ticker?.position?.status !== "pending";
              const busy = buyingSymbol === row.symbol;
              return (
                <tr key={row.symbol} className="bg-ocean-surface">
                  <td className="px-4 py-3 font-semibold text-ocean-foam">{row.symbol}</td>
                  <td className="px-4 py-3 tabular-nums text-ocean-sand">
                    {money(row.underlyingPrice)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ocean-sand">
                    {row.optimalRange.low}–{row.optimalRange.high}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ocean-foam">
                    {row.pick ? row.pick.strike : "—"}
                  </td>
                  <td className="px-4 py-3 text-ocean-sand">
                    {row.pick
                      ? `${row.pick.expiration} · ${row.pick.dte}d`
                      : row.expiration
                        ? `${row.expiration}`
                        : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ocean-sand">
                    {row.pick ? `${money(row.pick.bid)} / ${money(row.pick.ask)}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "text-sm font-medium uppercase tracking-wide",
                        row.status === "ok"
                          ? "text-ocean-teal-dim dark:text-ocean-teal"
                          : row.status === "skipped"
                            ? "text-amber-700 dark:text-amber-200"
                            : "text-ocean-danger",
                      )}
                    >
                      {row.status}
                    </span>
                    {row.message ? (
                      <p className="mt-1 max-w-xs text-sm leading-snug text-ocean-sand/80">
                        {row.message}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={disabled || busy || !canBuy}
                      onClick={() => onBuy(row)}
                      className="min-h-11 rounded-md bg-ocean-teal px-4 py-2.5 text-sm font-semibold text-ocean-deep hover:bg-ocean-teal/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? "Buying…" : "Buy"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
