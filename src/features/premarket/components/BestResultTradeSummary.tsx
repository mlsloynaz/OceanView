import { cn } from "@/shared/lib/cn";
import { formatMoneyPrice, type BestResultTradeSummary } from "../display";

type Props = {
  summary: BestResultTradeSummary;
  className?: string;
  /** Compact chip layout vs detail modal. */
  compact?: boolean;
};

function Row({
  label,
  value,
  compact,
  alwaysShow,
}: {
  label: string;
  value: string | null;
  compact?: boolean;
  /** Keep the row visible even when value is missing (e.g. Strike: —). */
  alwaysShow?: boolean;
}) {
  if (!value && !alwaysShow) return null;
  const display = value ?? "—";
  if (compact) {
    return (
      <span className="block text-[11px] font-normal leading-snug opacity-95">
        <span className="opacity-80">{label} </span>
        <span className="font-semibold tabular-nums">{display}</span>
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-xs text-ocean-sand">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-ocean-foam sm:text-right">{display}</dd>
    </div>
  );
}

function strikeValue(summary: BestResultTradeSummary): string | null {
  if (summary.suggestedStrike == null) return null;
  const parts = [String(summary.suggestedStrike)];
  if (summary.strikeExpiration) parts.push(summary.strikeExpiration);
  if (summary.strikeAsk != null) parts.push(`ask ${formatMoneyPrice(summary.strikeAsk)}`);
  return parts.join(" · ");
}

function obstacleValue(summary: BestResultTradeSummary): string | null {
  if (summary.estimatedObstacle == null) return null;
  const price = formatMoneyPrice(summary.estimatedObstacle);
  return summary.obstacleLabel ? `${price} (${summary.obstacleLabel})` : price;
}

/**
 * Best Results trade snapshot — current, profile exit, Camino obstacle, strike pick.
 */
export function BestResultTradeSummaryPanel({ summary, className, compact }: Props) {
  const strike = strikeValue(summary);

  if (compact) {
    return (
      <span className={cn("flex flex-col gap-0.5", className)}>
        <Row
          compact
          label="Current:"
          value={summary.currentPrice != null ? formatMoneyPrice(summary.currentPrice) : null}
        />
        <Row
          compact
          label="Est. exit:"
          value={summary.estimatedExit != null ? formatMoneyPrice(summary.estimatedExit) : null}
        />
        <Row compact label="Obstacle:" value={obstacleValue(summary)} />
        <Row compact label="Strike:" value={strike} alwaysShow />
      </span>
    );
  }

  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border border-ocean-mid/30 bg-ocean-deep/20 px-3 py-3",
        className,
      )}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ocean-sand">
        Trade levels
      </h3>
      <dl className="space-y-2">
        <Row
          label="Current price:"
          value={summary.currentPrice != null ? formatMoneyPrice(summary.currentPrice) : null}
        />
        <Row
          label="Estimated exit:"
          value={summary.estimatedExit != null ? formatMoneyPrice(summary.estimatedExit) : null}
        />
        <Row label="Estimated obstacle:" value={obstacleValue(summary)} />
        <Row label="Strike:" value={strike} alwaysShow />
      </dl>
    </div>
  );
}
