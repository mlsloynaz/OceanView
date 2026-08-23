import { useEffect, useId, useState } from "react";
import { PriceCalc } from "@/features/tools/calc/PriceCalc";
import { RangoOptimoLookup } from "@/features/tools/rango-optimo/RangoOptimoLookup";
import { cn } from "@/shared/lib/cn";

function ToolsBody() {
  return (
    <>
      <section aria-labelledby="tools-calc-heading" className="mb-6">
        <h2
          id="tools-calc-heading"
          className="mb-3 text-xs font-bold uppercase tracking-wider text-ocean-sand"
        >
          Calc
        </h2>
        <PriceCalc />
      </section>

      <section aria-labelledby="tools-rango-heading" className="border-t border-ocean-mid/40 pt-6">
        <h2
          id="tools-rango-heading"
          className="mb-3 text-xs font-bold uppercase tracking-wider text-ocean-sand"
        >
          Optimal range
        </h2>
        <RangoOptimoLookup />
      </section>
    </>
  );
}

/**
 * Tools sidebar: fixed column from `lg` up; drawer + toggle below that so
 * every main view keeps full width on tablet/phone.
 */
export function ToolsPane() {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Desktop / large tablet: persistent column */}
      <aside
        className="hidden w-72 shrink-0 flex-col border-r border-ocean-mid/60 bg-ocean-surface/60 lg:flex"
        aria-label="Tools panel"
      >
        <div className="border-b border-ocean-mid/40 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-widest text-ocean-teal">Tools</p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <ToolsBody />
        </div>
      </aside>

      {/* Compact: floating toggle + slide-over */}
      <div className="lg:hidden">
        <button
          type="button"
          className={cn(
            "fixed bottom-4 left-4 z-40 rounded-full border border-ocean-mid/50 bg-ocean-surface px-3.5 py-2",
            "text-xs font-semibold text-ocean-foam shadow-lg shadow-black/20",
            "hover:border-ocean-teal/50 hover:text-ocean-teal",
          )}
          aria-expanded={open}
          aria-controls="tools-drawer"
          onClick={() => setOpen(true)}
        >
          Tools
        </button>

        {open ? (
          <div className="fixed inset-0 z-50 flex" role="presentation">
            <button
              type="button"
              className="absolute inset-0 bg-ocean-deep/70 backdrop-blur-[2px]"
              aria-label="Close tools"
              onClick={() => setOpen(false)}
            />
            <aside
              id="tools-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="relative z-10 flex h-full w-[min(20rem,92vw)] flex-col border-r border-ocean-mid/60 bg-ocean-surface shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-ocean-mid/40 px-4 py-3">
                <p
                  id={titleId}
                  className="text-xs font-bold uppercase tracking-widest text-ocean-teal"
                >
                  Tools
                </p>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs font-semibold text-ocean-sand hover:bg-ocean-mid/40 hover:text-ocean-foam"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <ToolsBody />
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </>
  );
}
