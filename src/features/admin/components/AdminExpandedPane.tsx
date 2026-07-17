import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type Props = {
  id: string;
  title: ReactNode;
  subtitle?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function AdminExpandedPane({
  id,
  title,
  subtitle,
  headerExtra,
  children,
  className,
}: Props) {
  return (
    <section
      id={id}
      className={cn(
        "min-w-0 overflow-hidden rounded-xl border border-ocean-mid/50 bg-ocean-surface shadow-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ocean-mid/40 px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold text-ocean-foam">{title}</h2>
          {subtitle && <p className="mt-1 text-sm leading-relaxed text-ocean-sand">{subtitle}</p>}
        </div>
        {headerExtra ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{headerExtra}</div>
        ) : null}
      </div>
      <div className="max-h-[min(52rem,82vh)] overflow-y-auto px-5 py-4 text-sm leading-relaxed">
        {children}
      </div>
    </section>
  );
}
