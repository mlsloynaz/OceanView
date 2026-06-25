import { PriceCalc } from "@/features/tools/calc/PriceCalc";
import { RangoOptimoLookup } from "@/features/tools/rango-optimo/RangoOptimoLookup";

export function ToolsPane() {
  return (
    <aside
      className="flex w-72 shrink-0 flex-col border-l border-ocean-mid/60 bg-ocean-surface/60"
      aria-label="Tools panel"
    >
      <div className="border-b border-ocean-mid/40 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-ocean-teal">Tools</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <section aria-labelledby="tools-calc-heading" className="mb-6">
          <h2
            id="tools-calc-heading"
            className="mb-3 text-xs font-bold uppercase tracking-wider text-ocean-sand"
          >
            Calc
          </h2>
          <PriceCalc />
        </section>

        <section
          aria-labelledby="tools-rango-heading"
          className="border-t border-ocean-mid/40 pt-6"
        >
          <h2
            id="tools-rango-heading"
            className="mb-3 text-xs font-bold uppercase tracking-wider text-ocean-sand"
          >
            Optimal range
          </h2>
          <RangoOptimoLookup />
        </section>
      </div>
    </aside>
  );
}
