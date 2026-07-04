import { useState } from "react";
import { CollapsibleSection } from "@/shared/components/CollapsibleSection";
import type { PremarketSymbolOutcome } from "../types";

type Props = {
  outcomes: PremarketSymbolOutcome[];
  embedded?: boolean;
};

function DiagnosticsList({ outcomes }: { outcomes: PremarketSymbolOutcome[] }) {
  return (
    <ul className="divide-y divide-ocean-mid/40 text-sm">
      {outcomes.map((row) => (
        <li key={row.symbol} className="flex flex-wrap items-center gap-2 py-2">
          <span className="font-semibold text-ocean-foam">{row.symbol}</span>
          <span
            className={
              row.ready ? "text-ocean-teal-dim dark:text-ocean-teal" : "text-ocean-danger"
            }
          >
            {row.ready ? "ready" : "not ready"}
          </span>
          {row.error && <span className="text-xs text-ocean-sand">{row.error}</span>}
        </li>
      ))}
    </ul>
  );
}

export function PremarketDiagnostics({ outcomes, embedded = false }: Props) {
  const [open, setOpen] = useState(false);
  const issues = outcomes.filter((row) => !row.ready || row.error);

  if (outcomes.length === 0) return null;

  if (embedded) {
    return <DiagnosticsList outcomes={outcomes} />;
  }

  return (
    <CollapsibleSection
      id="premarket-diagnostics"
      title="Symbol diagnostics"
      subtitle={
        issues.length > 0
          ? `${issues.length} with issues · ${outcomes.length} total`
          : `${outcomes.length} symbols evaluated`
      }
      open={open}
      onOpenChange={setOpen}
      className="min-w-0"
    >
      <DiagnosticsList outcomes={outcomes} />
    </CollapsibleSection>
  );
}
