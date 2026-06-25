import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type CollapsibleSectionProps = {
  id: string;
  title: ReactNode;
  subtitle?: string;
  headerExtra?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn(
        "h-5 w-5 text-ocean-sand transition-transform",
        open && "rotate-180",
      )}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function CollapsibleSection({
  id,
  title,
  subtitle,
  headerExtra,
  open,
  onOpenChange,
  children,
  className,
}: CollapsibleSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "overflow-hidden rounded-xl border border-ocean-mid/50 bg-ocean-surface shadow-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ocean-mid/40 px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ocean-foam">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-ocean-sand">{subtitle}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {headerExtra}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`${id}-body`}
            onClick={() => onOpenChange(!open)}
            className="rounded-md p-1 text-ocean-sand hover:bg-ocean-mid/30 hover:text-ocean-foam"
          >
            <span className="sr-only">{open ? "Collapse" : "Expand"}</span>
            <Chevron open={open} />
          </button>
        </div>
      </div>
      {open && (
        <div id={`${id}-body`} className="max-h-[min(36rem,75vh)] overflow-y-auto px-3 py-2 text-xs">
          {children}
        </div>
      )}
    </section>
  );
}
