import { cn } from "@/shared/lib/cn";
import { formatCalcResult } from "@/shared/lib/price-calc";
import type { DangerEval, TradeDirection } from "../types";
import { directionBadgeClass, qualityBadgeClass } from "../display";
type QualityDisplayProps = {
  qualityPct: number;
  threshold: number;
  qualityPctRaw?: number | null;
  dangerPenaltyPct?: number | null;
  className?: string;
};

export function QualityDisplay({
  qualityPct,
  threshold,
  qualityPctRaw,
  dangerPenaltyPct,
  className,
}: QualityDisplayProps) {
  const raw = qualityPctRaw ?? qualityPct;
  const penalized = typeof dangerPenaltyPct === "number" && dangerPenaltyPct < 0;

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      <span
        className={cn(
          "rounded px-2 py-0.5 text-xs font-semibold tabular-nums",
          qualityBadgeClass(qualityPct, threshold),
        )}
        title={penalized ? `Adjusted after danger penalty (${dangerPenaltyPct}%)` : undefined}
      >
        {qualityPct}%
      </span>
      {penalized && raw !== qualityPct && (
        <span className="text-[10px] tabular-nums text-ocean-sand line-through">{raw}%</span>
      )}
      {penalized && (
        <span className="rounded bg-ocean-danger-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ocean-danger">
          {dangerPenaltyPct}%
        </span>
      )}
    </span>
  );
}

type DirectionDisplayProps = {
  direction: TradeDirection | null | undefined;
  directionEvidence?: string | null;
  directionConfidence?: string | null;
  compact?: boolean;
};

export function DirectionDisplay({
  direction,
  directionEvidence,
  directionConfidence,
  compact = false,
}: DirectionDisplayProps) {
  if (!direction) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded font-bold uppercase",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        directionBadgeClass(direction),
      )}
      title={[directionEvidence, directionConfidence ? `Confidence: ${directionConfidence}` : null]
        .filter(Boolean)
        .join(" · ")}
    >
      {direction}
    </span>
  );
}

type DangersPanelProps = {
  dangers?: DangerEval[] | null;
  className?: string;
};

function formatGapUsd(value: unknown): string | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return formatCalcResult(n);
}
  if (status === "passed") return "text-ocean-teal-dim dark:text-ocean-teal";
  if (status === "failed") return "text-ocean-danger";
  return "text-ocean-sand";
}

function dangerStatusLabel(status: DangerEval["status"]): string {
  if (status === "passed") return "OK";
  if (status === "failed") return "Failed";
  return "Unknown";
}

export function DangersPanel({ dangers, className }: DangersPanelProps) {
  if (!dangers?.length) return null;

  const failed = dangers.filter((d) => d.status === "failed");

  return (
    <div className={cn("rounded-lg border border-ocean-mid/40 bg-ocean-deep/30", className)}>
      <div className="flex items-center justify-between border-b border-ocean-mid/30 px-3 py-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-ocean-sand">
          Dangers
        </h4>
        {failed.length > 0 && (
          <span className="text-[10px] font-semibold text-ocean-danger">
            {failed.length} failed
          </span>
        )}
      </div>
      <ul className="divide-y divide-ocean-mid/20">
        {dangers.map((danger) => {
          const gapLabel = formatGapUsd(danger.gapUsd);
          return (
          <li key={danger.dangerKey} className="px-3 py-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wide",
                  dangerStatusClass(danger.status),
                )}
              >
                {dangerStatusLabel(danger.status)}
              </span>
              <span className="font-medium text-ocean-foam">
                {danger.dangerKey === "clear_path"
                  ? "Camino libre ≥ $2"
                  : danger.dangerKey}
              </span>
              {danger.direction && (
                <DirectionDisplay direction={danger.direction} compact />
              )}
              {danger.status === "failed" && danger.penaltyPct != null && danger.penaltyPct !== 0 && (
                <span className="text-[10px] tabular-nums text-ocean-danger">
                  −{Math.abs(danger.penaltyPct)}%
                </span>
              )}
            </div>
            {danger.evidence && (
              <p className="mt-1 text-xs leading-relaxed text-ocean-sand">{danger.evidence}</p>
            )}
            {gapLabel != null && danger.status === "failed" && (
              <p className="mt-0.5 text-[11px] tabular-nums text-ocean-sand">
                Room: ${gapLabel}
              </p>
            )}
          </li>
          );
        })}
      </ul>
    </div>
  );
}

type StrategyAssessMetaProps = {
  direction?: TradeDirection | null;
  directionEvidence?: string | null;
  directionConfidence?: string | null;
  qualityPct: number;
  threshold: number;
  qualityPctRaw?: number | null;
  dangerPenaltyPct?: number | null;
  dangers?: DangerEval[] | null;
  showDangers?: boolean;
};

export function StrategyAssessMeta({
  direction,
  directionEvidence,
  directionConfidence,
  qualityPct,
  threshold,
  qualityPctRaw,
  dangerPenaltyPct,
  dangers,
  showDangers = true,
}: StrategyAssessMetaProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <QualityDisplay
          qualityPct={qualityPct}
          threshold={threshold}
          qualityPctRaw={qualityPctRaw}
          dangerPenaltyPct={dangerPenaltyPct}
        />
        <DirectionDisplay
          direction={direction}
          directionEvidence={directionEvidence}
          directionConfidence={directionConfidence}
        />
      </div>
      {directionEvidence && (
        <p className="text-xs leading-relaxed text-ocean-sand">{directionEvidence}</p>
      )}
      {showDangers && <DangersPanel dangers={dangers} />}
    </div>
  );
}
