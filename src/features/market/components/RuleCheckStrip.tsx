import type { RuleDisplayRow } from "../types";
import { isBonusRuleType, sortRulesForDisplay } from "../display";
import { RuleCheckIcon } from "./RuleCheckIcon";

type Props = {
  rules: RuleDisplayRow[];
  className?: string;
};

export function RuleCheckStrip({ rules, className = "" }: Props) {
  if (rules.length === 0) return null;

  const ordered = sortRulesForDisplay(rules);

  return (
    <span
      className={`inline-flex items-baseline gap-0.5 shrink-0 ${className}`.trim()}
      title={ordered
        .map((r) => `${r.label}${isBonusRuleType(r.type) ? " (bonus)" : ""}: ${r.status}`)
        .join(" · ")}
    >
      {ordered.map((rule) => {
        const bonus = isBonusRuleType(rule.type);
        return (
          <RuleCheckIcon
            key={`${rule.ruleKey}-${rule.type}-${rule.status}`}
            status={rule.status}
            title={bonus ? `${rule.label} (bonus)` : rule.label}
            size={bonus ? "sm" : "md"}
          />
        );
      })}
    </span>
  );
}
