import type { RuleDisplayRow } from "../types";
import { formatAchievedTimeEt, ruleStatusClass } from "../display";
import { RuleCheckIcon } from "./RuleCheckIcon";
import { cn } from "@/shared/lib/cn";

type Props = {
  rules: RuleDisplayRow[];
  className?: string;
};

function suffixForRow(row: RuleDisplayRow): string | null {
  if (row.status === "partial") return "near";
  if (row.status === "not_met") return "confirm";
  return null;
}

export function RuleRequirementsList({ rules, className }: Props) {
  if (rules.length === 0) {
    return <p className="text-xs text-ocean-sand">No rules defined.</p>;
  }

  return (
    <ul className={cn("space-y-1.5", className)}>
      {rules.map((row) => {
        const suffix = suffixForRow(row);
        const passedAt =
          row.status === "met" && row.metAtEt?.trim()
            ? formatAchievedTimeEt(row.metAtEt)
            : null;

        return (
          <li
            key={row.ruleKey}
            className={cn(
              "flex items-start gap-2 text-xs leading-snug",
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
              {row.status === "met" && row.evidence && (
                <span className="mt-0.5 block text-[10px] opacity-75">{row.evidence}</span>
              )}
            </span>
            {passedAt && (
              <span
                className="shrink-0 tabular-nums text-[11px] font-medium text-ocean-teal-dim dark:text-ocean-teal"
                title="Passed at (ET)"
              >
                {passedAt}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
