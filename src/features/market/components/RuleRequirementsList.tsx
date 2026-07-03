import type { RuleDisplayRow } from "../types";
import {
  extractTimeFromEvidence,
  formatRulePassedTimeOnly,
  formatRuleThresholdSummary,
  ruleStatusClass,
} from "../display";
import { RuleCheckIcon } from "./RuleCheckIcon";
import { cn } from "@/shared/lib/cn";

type Props = {
  rules: RuleDisplayRow[];
  className?: string;
  /** Large highlighted clock time for passed rules (premarket detail). */
  highlightPassedTime?: boolean;
  /** Show compact measured vs threshold values from evidence. */
  showMetrics?: boolean;
  /** Show pass time for met rules even without highlightPassedTime. */
  showPassedTime?: boolean;
};

function suffixForRow(row: RuleDisplayRow): string | null {
  if (row.status === "partial") return "near";
  if (row.status === "not_met") return "confirm";
  return null;
}

function passedTimeForRow(row: RuleDisplayRow): string | null {
  if (row.status !== "met") return null;
  return formatRulePassedTimeOnly(row.metAtEt) ?? extractTimeFromEvidence(row.evidence);
}

export function RuleRequirementsList({
  rules,
  className,
  highlightPassedTime = false,
  showMetrics = false,
  showPassedTime = false,
}: Props) {
  if (rules.length === 0) {
    return <p className="text-xs text-ocean-sand">No rules defined.</p>;
  }

  return (
    <ul className={cn("space-y-2", className)}>
      {rules.map((row) => {
        const suffix = suffixForRow(row);
        const passedTime = passedTimeForRow(row);
        const metrics = showMetrics ? formatRuleThresholdSummary(row.evidence) : null;
        const showEvidence =
          Boolean(row.evidence?.trim()) &&
          row.status !== "pending" &&
          (row.status === "not_met" || !metrics || row.status === "met");
        const showTime = passedTime && (highlightPassedTime || showPassedTime);

        return (
          <li
            key={row.ruleKey}
            className={cn(
              highlightPassedTime && passedTime
                ? "rounded-lg border border-ocean-mid/30 bg-ocean-deep/25 px-3 py-2.5"
                : undefined,
            )}
          >
            <div
              className={cn(
                "flex items-start gap-2 leading-snug",
                highlightPassedTime ? "text-sm" : "text-xs",
                ruleStatusClass(row.status),
              )}
            >
              <span className="mt-px shrink-0" aria-hidden>
                <RuleCheckIcon status={row.status} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={row.type === "required" ? "font-medium" : undefined}>
                  {row.label}
                </span>
                {row.type === "extra" && (
                  <span className="ml-1 text-[10px] uppercase tracking-wide text-ocean-sand">
                    extra
                  </span>
                )}
                {suffix && (
                  <span className="ml-1 font-medium opacity-80">· {suffix}</span>
                )}
              </span>
              {showTime && highlightPassedTime ? (
                <span
                  className="shrink-0 rounded-md bg-ocean-teal/20 px-2.5 py-1 text-xl font-bold tabular-nums tracking-tight text-ocean-teal dark:text-ocean-teal"
                  title="Passed at (ET)"
                >
                  {passedTime}
                </span>
              ) : showTime ? (
                <span
                  className="shrink-0 tabular-nums text-[11px] font-medium text-ocean-teal-dim dark:text-ocean-teal"
                  title="Passed at (ET)"
                >
                  {passedTime}
                </span>
              ) : null}
            </div>
            {metrics && (
              <p
                className={cn(
                  "font-medium tabular-nums text-ocean-sand/90",
                  highlightPassedTime ? "mt-1.5 pl-5 text-xs" : "mt-0.5 pl-5 text-[10px]",
                )}
              >
                {metrics}
              </p>
            )}
            {showEvidence && !metrics && (
              <p
                className={cn(
                  "leading-snug",
                  row.status === "met"
                    ? "text-ocean-sand/85"
                    : "text-ocean-sand/70 italic",
                  highlightPassedTime ? "mt-2 pl-5 text-xs" : "mt-0.5 block text-[10px] opacity-75",
                )}
              >
                {row.evidence}
              </p>
            )}
            {showEvidence && metrics && (
              <p
                className={cn(
                  "leading-snug text-ocean-sand/60",
                  highlightPassedTime ? "mt-1 pl-5 text-[11px]" : "mt-0.5 pl-5 text-[10px] opacity-70",
                )}
              >
                {row.evidence}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
