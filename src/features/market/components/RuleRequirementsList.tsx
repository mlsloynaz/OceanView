import type { RuleDisplayRow } from "../types";
import {
  extractTimeFromEvidence,
  formatRulePassedTimeOnly,
  formatRuleThresholdSummary,
  ruleStatusClass,
  ruleStatusTitle,
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
  if (row.type === "extra") return null;
  if (row.status === "partial") return "near";
  if (row.status === "not_met") return ruleStatusTitle("not_met").toLowerCase();
  return null;
}

function passedTimeForRow(row: RuleDisplayRow): string | null {
  if (row.status !== "met") return null;
  return formatRulePassedTimeOnly(row.metAtEt) ?? extractTimeFromEvidence(row.evidence);
}

function verdictHeadline(row: RuleDisplayRow): string | null {
  const trend = row.suggestedTrend?.trim();
  const op = row.suggestedDirection?.trim().toUpperCase();
  if (!trend || (op !== "CALL" && op !== "PUT")) return null;
  const label = trend.charAt(0).toUpperCase() + trend.slice(1).toLowerCase();
  return `${label} → operación ${op}.`;
}

/** Drop leading "Alcista → operación PUT." when we render it as a larger headline. */
function evidenceWithoutVerdict(evidence: string | null | undefined, headline: string | null): string {
  const text = evidence?.trim() ?? "";
  if (!text || !headline) return text;
  const escaped = headline.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`^${escaped}\\s*`, "i"), "").trim();
}

/** Drop leading clocks when the pass-time badge already shows them. */
function evidenceWithoutLeadingClock(evidence: string, passedTime: string | null): string {
  let text = evidence.trim();
  if (!text) return text;

  // "9:30 gap mid @ 09:30: …" / "Gap mid @ 09:30: …"
  text = text.replace(/^\d{1,2}:\d{2}\s+gap mid @\s*\d{1,2}:\d{2}:\s*/i, "Gap mid: ");
  text = text.replace(/^gap mid @\s*\d{1,2}:\d{2}:\s*/i, "Gap mid: ");
  text = text.replace(/^Premarket gap mid @\s*\d{1,2}:\d{2}:\s*/i, "Premarket gap mid: ");
  text = text.replace(/^Prior session 15m @\s*[\d\-T: ]+:\s*/i, "");

  if (passedTime) {
    const clock = passedTime.replace(/\s*(AM|PM)\s*$/i, "").trim();
    if (clock) {
      const escaped = clock.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      text = text.replace(new RegExp(`^${escaped}\\s*[:\\-–]?\\s*`, "i"), "").trim();
    }
  }

  return text;
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
    <ul className={cn("space-y-2 overflow-visible", className)}>
      {rules.map((row) => {
        const suffix = suffixForRow(row);
        const passedTime = passedTimeForRow(row);
        const showTime = showTimeForRow(passedTime, highlightPassedTime, showPassedTime);
        const metrics = showMetrics ? formatRuleThresholdSummary(row.evidence) : null;
        const verdict = row.status === "met" || row.status === "partial" ? verdictHeadline(row) : null;
        const rawDetail = evidenceWithoutVerdict(row.evidence, verdict);
        const detailEvidence = evidenceWithoutLeadingClock(
          rawDetail,
          showTime ? passedTime : null,
        );
        // Prefer metrics OR detail — never both (avoids duplicate lines).
        const showMetricsLine = Boolean(metrics);
        const showEvidence =
          Boolean(detailEvidence) &&
          !showMetricsLine &&
          row.status !== "pending" &&
          (row.status === "not_met" || row.status === "met" || row.status === "partial" || Boolean(verdict));

        return (
          <li key={row.ruleKey} className="min-w-0 overflow-visible">
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
                  <span
                    className="ml-1.5 inline-block text-[10px] uppercase tracking-wide text-ocean-sand"
                    title="Informational only — does not affect quality %"
                  >
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
            {verdict && (
              <p
                className={cn(
                  "min-w-0 pl-5 font-semibold tracking-tight text-ocean-foam break-words",
                  highlightPassedTime ? "mt-2 text-lg" : "mt-1 text-base",
                )}
              >
                {verdict}
              </p>
            )}
            {showMetricsLine && (
              <p
                className={cn(
                  "min-w-0 pl-5 font-medium tabular-nums text-ocean-sand/90 break-words",
                  highlightPassedTime ? "mt-1.5 text-xs" : "mt-0.5 text-[10px]",
                )}
              >
                {metrics}
              </p>
            )}
            {showEvidence && (
              <p
                className={cn(
                  "min-w-0 pl-5 leading-snug break-words overflow-visible",
                  row.status === "met"
                    ? "text-ocean-sand/85"
                    : "text-ocean-sand/70 italic",
                  highlightPassedTime
                    ? cn("text-xs", verdict ? "mt-1" : "mt-2")
                    : cn("text-[10px] opacity-75", verdict ? "mt-0.5" : "mt-0.5"),
                )}
              >
                {detailEvidence}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function showTimeForRow(
  passedTime: string | null,
  highlightPassedTime: boolean,
  showPassedTime: boolean,
): boolean {
  return Boolean(passedTime && (highlightPassedTime || showPassedTime));
}
