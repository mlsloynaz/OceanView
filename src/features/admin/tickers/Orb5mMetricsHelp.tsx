import { useEffect, useRef } from "react";
import { cn } from "@/shared/lib/cn";
import {
  BEST_FIT_ORB5M_ALL_METRIC_HELP,
  BEST_FIT_ORB5M_RANKING_HELP,
} from "./best-fit-orb5m-column-help";

type Props = {
  focusId?: string | null;
};

export function Orb5mMetricsHelp({ focusId }: Props) {
  const focusRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (!focusId || !focusRef.current) return;
    focusRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusId]);

  return (
    <div>
      <div className="mb-4 rounded-md border border-ocean-teal/25 bg-ocean-teal/10 px-3 py-2.5">
        <p className="text-sm font-semibold text-ocean-teal-dim dark:text-ocean-teal">
          {BEST_FIT_ORB5M_RANKING_HELP.title}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ocean-sand">
          {BEST_FIT_ORB5M_RANKING_HELP.summary}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ocean-sand">
          {BEST_FIT_ORB5M_RANKING_HELP.gate}
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-ocean-sand">
          {BEST_FIT_ORB5M_RANKING_HELP.pieces.map((piece) => (
            <li key={piece.label}>
              <span className="font-medium text-ocean-foam">{piece.label}</span>
              <span className="text-ocean-sand/80"> ({piece.points})</span>
              {" — "}
              {piece.why}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ocean-sand">{BEST_FIT_ORB5M_RANKING_HELP.tiers}</p>
      </div>
      <ul className="space-y-3 text-sm text-ocean-foam">
        {BEST_FIT_ORB5M_ALL_METRIC_HELP.map((item) => {
          const focused = item.id === focusId;
          return (
            <li
              key={item.id}
              ref={focused ? focusRef : undefined}
              id={`orb5m-help-${item.id}`}
              className={cn(
                "border-b border-ocean-mid/25 pb-3 last:border-0 last:pb-0",
                focused && "rounded-md border border-ocean-teal/40 bg-ocean-teal/10 px-2 py-2 last:border",
              )}
            >
              <p className="font-semibold text-ocean-teal-dim dark:text-ocean-teal">{item.column}</p>
              <p className="mt-0.5 text-ocean-sand">{item.meaning}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
