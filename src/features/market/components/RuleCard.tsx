import type { RuleCardModel } from "../types";
import { RuleCheckIcon } from "./RuleCheckIcon";
import { cn } from "@/shared/lib/cn";

type Props = {
  card: RuleCardModel;
};

export function RuleCard({ card }: Props) {
  const { label, type, timeframe, strategyName, metCount, totalSymbols, previewSymbols } = card;

  return (
    <article className="flex flex-col rounded-lg border border-ocean-mid/40 bg-ocean-deep/40 p-3 shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium text-ocean-foam">{label}</p>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-ocean-sand">{strategyName}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-ocean-sand">
          <span
            className={cn(
              "rounded px-1 py-0.5 font-medium uppercase tracking-wide",
              type === "required"
                ? "bg-ocean-teal/15 text-ocean-teal-dim dark:text-ocean-teal"
                : "bg-ocean-mid/30",
            )}
          >
            {type}
          </span>
          {timeframe && <span>{timeframe}</span>}
        </div>
      </div>

      <div className="mt-3 border-t border-ocean-mid/30 pt-2">
        <p className="text-xs text-ocean-sand">
          {metCount} of {totalSymbols} tickers met
        </p>
        {previewSymbols.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {previewSymbols.map((row) => (
              <li key={row.symbol} className="flex items-center gap-2 text-xs text-ocean-foam">
                <RuleCheckIcon status={row.status} className="shrink-0" />
                <span className="font-medium">{row.symbol}</span>
                {row.status === "met" && row.metAtEt && (
                  <span className="text-ocean-sand">{row.metAtEt}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-ocean-sand">No evaluations yet.</p>
        )}
      </div>
    </article>
  );
}
