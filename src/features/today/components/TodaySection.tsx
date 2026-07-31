import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type Props = {
  id: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function TodaySection({ id, title, subtitle, actions, children, className }: Props) {
  return (
    <section
      id={id}
      className={cn(
        "min-w-0 overflow-hidden rounded-xl border border-ocean-mid/50 bg-ocean-surface shadow-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ocean-mid/40 px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-ocean-foam">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-ocean-sand">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}
