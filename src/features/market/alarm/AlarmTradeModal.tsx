import { MarketDetailModal } from "@/features/market/components/MarketDetailModal";
import { formatEarningPctLabel, formatTopRatedLine } from "./alarm-enter-pool";
import {
  formatAlarmTrend,
  type AlarmPopupKind,
  type AlarmPopupPoolEntry,
  type MarketAlarmWatch,
} from "./alarm-types";
import { cn } from "@/shared/lib/cn";

type Props = {
  watch: MarketAlarmWatch;
  kind: AlarmPopupKind;
  onClose: () => void;
  /** Enter: start monitoring for exit. Exit: reset watch so it can alarm again. */
  onConfirm: () => void;
  /** Multi-ENTER pool (top first). When length ≥ 2, list all and highlight top. */
  poolEntries?: AlarmPopupPoolEntry[];
  topRatedSymbol?: string;
  topRatedEarningPct?: number | null;
};

function sideLabelOf(watch: MarketAlarmWatch): string {
  const side =
    watch.lastDetectedTrend === "alcista" || watch.lastDetectedTrend === "bajista"
      ? watch.lastDetectedTrend
      : watch.trend;
  return side === "alcista" || side === "bajista"
    ? formatAlarmTrend(side)
    : formatAlarmTrend(watch.trend);
}

export function AlarmTradeModal({
  watch,
  kind,
  onClose,
  onConfirm,
  poolEntries,
  topRatedSymbol,
  topRatedEarningPct,
}: Props) {
  const sideLabel = sideLabelOf(watch);
  const isEnter = kind === "enter";
  const evidence = isEnter ? watch.lastEvidence : watch.exitEvidence ?? watch.lastEvidence;
  const when = isEnter ? watch.metAt : watch.exitedAt;
  const multi = isEnter && (poolEntries?.length ?? 0) > 1;
  const showTopRef =
    isEnter &&
    !multi &&
    !!topRatedSymbol &&
    topRatedSymbol.trim().toUpperCase() !== watch.symbol.trim().toUpperCase();

  const title = !isEnter
    ? `Exit: ${watch.symbol}`
    : multi
      ? `Enter: ${poolEntries!.length} signals`
      : `Enter: ${watch.symbol}`;
  const subtitle = multi
    ? `Top ${topRatedSymbol ?? watch.symbol} · pooled ENTERs`
    : `${watch.ruleLabel} · ${sideLabel}`;

  return (
    <MarketDetailModal open onClose={onClose} title={title} subtitle={subtitle}>
      <div className="space-y-3 text-sm text-ocean-foam">
        {multi ? (
          <ul className="space-y-2">
            {poolEntries!.map((row) => (
              <li
                key={row.watchId}
                className={cn(
                  "rounded-md border px-3 py-2",
                  row.isTop
                    ? "border-ocean-teal/50 bg-ocean-teal/10"
                    : "border-ocean-mid/30 bg-ocean-deep/20",
                )}
              >
                <p
                  className={cn(
                    "tabular-nums text-ocean-foam",
                    row.isTop ? "text-lg font-bold" : "text-base font-semibold",
                  )}
                >
                  {row.isTop ? (
                    <span className="text-ocean-teal-dim dark:text-ocean-teal">
                      {formatTopRatedLine(row.symbol, row.earningPct)}
                    </span>
                  ) : (
                    <>
                      {row.symbol}
                      <span className="ml-2 font-medium text-ocean-sand">
                        {formatEarningPctLabel(row.earningPct)}
                      </span>
                    </>
                  )}
                </p>
                <p className={cn("mt-0.5 text-ocean-sand", row.isTop ? "text-sm" : "text-xs")}>
                  {row.ruleLabel} · {row.sideLabel}
                </p>
                {row.evidence ? (
                  <p className="mt-0.5 text-[11px] text-ocean-sand/90">{row.evidence}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <>
            {showTopRef ? (
              <p className="text-lg font-bold text-ocean-teal-dim dark:text-ocean-teal">
                {formatTopRatedLine(topRatedSymbol!, topRatedEarningPct)}
              </p>
            ) : null}
            <p
              className={
                isEnter
                  ? "text-base font-semibold text-ocean-teal-dim dark:text-ocean-teal"
                  : "text-base font-semibold text-amber-700 dark:text-amber-200"
              }
            >
              {isEnter
                ? `ENTER now — rule met (${sideLabel}).`
                : `EXIT now — setup no longer met (${sideLabel}).`}
            </p>
            {evidence ? <p className="text-ocean-sand">{evidence}</p> : null}
            {typeof watch.lastBreakoutScore === "number" ? (
              <p className="text-xs text-ocean-sand">Score {Math.round(watch.lastBreakoutScore)}</p>
            ) : null}
            {when ? (
              <p className="text-xs text-ocean-sand">
                {isEnter ? "Signal at" : "Exit at"} {new Date(when).toLocaleString()}
              </p>
            ) : null}
          </>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={onConfirm}
            className={
              isEnter
                ? "rounded-md bg-ocean-teal px-3 py-1.5 text-xs font-semibold text-ocean-deep hover:brightness-105"
                : "rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-ocean-deep hover:brightness-105"
            }
          >
            {isEnter
              ? multi
                ? "Entered all — watch for exit"
                : "Entered — watch for exit"
              : "Exited — arm again"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-ocean-mid/40 px-3 py-1.5 text-xs font-semibold text-ocean-sand hover:bg-ocean-mid/15"
          >
            Dismiss
          </button>
        </div>
        <p className="text-[11px] text-ocean-sand/90">
          {isEnter
            ? multi
              ? "Confirm or Dismiss applies to every ticker in this list — popup and bell stop; each continues polling for exit."
              : "Confirm after you enter, or Dismiss if you already saw this — the popup and bell stop. Polling continues and will alert only on exit."
            : "Confirm after you exit, or Dismiss if you already saw this — the popup and bell stop. No new ENTER until the setup has been unmet."}
        </p>
      </div>
    </MarketDetailModal>
  );
}
