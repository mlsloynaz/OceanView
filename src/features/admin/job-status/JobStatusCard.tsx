import { cn } from "@/shared/lib/cn";
import { cardClass, statusToneClass } from "./display";
import type { JobStatusCardModel } from "./types";

type Props = {
  card: JobStatusCardModel;
};

export function JobStatusCard({ card }: Props) {
  return (
    <article className={cardClass(card.kind)} aria-label={`${card.title} job status`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className={cn("font-display text-sm font-semibold", statusToneClass(card.kind))}>
          {card.title}
        </h3>
        <span
          className={cn(
            "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            card.kind === "ok" && "border-ocean-teal/40 text-ocean-teal",
            card.kind === "running" && "border-amber-500/40 text-amber-800 dark:text-amber-100",
            card.kind === "warn" && "border-amber-500/40 text-amber-800 dark:text-amber-100",
            card.kind === "error" && "border-ocean-danger-border text-ocean-danger",
            card.kind === "none" && "border-ocean-mid/40 text-ocean-sand",
          )}
        >
          {card.kind === "none" ? "idle" : card.kind}
        </span>
      </div>
      <p className={cn("text-xs leading-relaxed", statusToneClass(card.kind))}>{card.body}</p>
      {card.meta ? (
        <p className="mt-2 text-[11px] text-ocean-sand/80">{card.meta}</p>
      ) : null}
      {card.runId ? (
        <p className="mt-1 truncate font-mono text-[10px] text-ocean-sand/60" title={card.runId}>
          {card.runId}
        </p>
      ) : null}
    </article>
  );
}
