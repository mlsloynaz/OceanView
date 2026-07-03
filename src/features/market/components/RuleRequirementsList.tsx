import type { RuleDisplayRow } from "../types";
import {
  extractTimeFromEvidence,
  formatRulePassedTimeOnly,
  ruleStatusClass,
} from "../display";
import { RuleCheckIcon } from "./RuleCheckIcon";
import { cn } from "@/shared/lib/cn";

type Props = {
  rules: RuleDisplayRow[];
  className?: string;
  /** Large highlighted clock time for passed rules (premarket detail). */
  highlightPassedTime?: boolean;
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
}: Props) {
  if (rules.length === 0) {
    return <p className="text-xs text-ocean-sand">No rules defined.</p>;
  }

  return (
    <ul className={cn("space-y-2", className)}>
      {rules.map((row) => {
        const suffix = suffixForRow(row);
        const passedTime = passedTimeForRow(row);

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
              {passedTime && highlightPassedTime ? (
                <span
                  className="shrink-0 rounded-md bg-ocean-teal/20 px-2.5 py-1 text-xl font-bold tabular-nums tracking-tight text-ocean-teal dark:text-ocean-teal"
                  title="Passed at (ET)"
                >
                  {passedTime}
                </span>
              ) : passedTime ? (
                <span
                  className="shrink-0 tabular-nums text-[11px] font-medium text-ocean-teal-dim dark:text-ocean-teal"
                  title="Passed at (ET)"
                >
                  {passedTime}
                </span>
              ) : null}
            </div>
            {row.status === "met" && row.evidence && (
              <p
                className={cn(
                  "text-ocean-sand/85 leading-snug",
                  highlightPassedTime ? "mt-2 pl-5 text-xs" : "mt-0.5 block text-[10px] opacity-75",
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
