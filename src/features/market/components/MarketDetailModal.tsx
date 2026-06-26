import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: string;
  children: ReactNode;
  className?: string;
};

export function MarketDetailModal({ open, onClose, title, subtitle, children, className }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="market-detail-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-ocean-deep/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={cn(
          "relative z-10 flex max-h-[min(90vh,48rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-ocean-mid/50 bg-ocean-surface shadow-xl",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-ocean-mid/40 px-4 py-3">
          <div className="min-w-0">
            <h2 id="market-detail-title" className="font-display text-xl font-semibold text-ocean-foam">
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-sm text-ocean-sand">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-ocean-sand hover:bg-ocean-mid/30 hover:text-ocean-foam"
            aria-label="Close dialog"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
