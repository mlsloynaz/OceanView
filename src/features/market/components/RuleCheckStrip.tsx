import type { RuleDisplayRow } from "../types";
import { RuleCheckIcon } from "./RuleCheckIcon";

type Props = {
  rules: RuleDisplayRow[];
  className?: string;
};

export function RuleCheckStrip({ rules, className = "" }: Props) {
  if (rules.length === 0) return null;

  return (
    <span
      className={`inline-flex items-center gap-0.5 shrink-0 ${className}`.trim()}
      title={rules.map((r) => `${r.label}: ${r.status}`).join(" · ")}
    >
      {rules.map((rule) => (
        <RuleCheckIcon key={rule.ruleKey} status={rule.status} title={rule.label} />
      ))}
    </span>
  );
}
