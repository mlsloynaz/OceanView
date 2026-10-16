import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type Props = {
  id: string;
  title: ReactNode;
  subtitle?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * true: body always scrolls inside the pane.
   * responsive: page scrolls below md; pane scrolls from md up.
   */
  scrollBody?: boolean | "responsive";
};

export function AdminExpandedPane({
  id,
  title,
  subtitle,
  headerExtra,
  children,
  className,
  scrollBody = true,
}: Props) {
  return (
    <section
      id={id}
      className={cn(
        "min-w-0 overflow-hidden rounded-xl border border-ocean-mid/50 bg-ocean-surface shadow-sm",
        className,
      )}
    >
      <div className="flex flex-col gap-3 border-b border-ocean-mid/40 px-3 py-3 sm:px-5 sm:py-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 xl:max-w-md">
          <h2 className="font-display text-xl font-semibold text-ocean-foam">{title}</h2>
          {subtitle && <p className="mt-1 text-sm leading-relaxed text-ocean-sand">{subtitle}</p>}
        </div>
        {headerExtra ? (
          <div className="flex min-w-0 w-full flex-wrap items-center justify-end gap-2 xl:w-auto xl:flex-1">
            {headerExtra}
          </div>
        ) : null}
      </div>
      <div
        className={cn(
          "px-3 py-3 text-sm leading-relaxed sm:px-5 sm:py-4",
          scrollBody === "responsive"
            ? "md:max-h-[min(52rem,82vh)] md:overflow-y-auto"
            : scrollBody === false
              ? undefined
              : "max-h-[min(52rem,82vh)] overflow-y-auto",
        )}
      >
        {children}
      </div>
    </section>
  );
}
