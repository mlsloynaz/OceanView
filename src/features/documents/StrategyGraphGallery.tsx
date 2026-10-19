import { useEffect, useState } from "react";
import type { StrategyPic } from "./catalog";

function picSrc(pic: StrategyPic): string {
  return `/strategy-docs/raw/${pic.file}`;
}

export function StrategyGraphGallery({
  groups,
}: {
  groups: { title: string; pics: StrategyPic[] }[];
}) {
  const [active, setActive] = useState<StrategyPic | null>(null);
  const visible = groups.filter((group) => group.pics.length > 0);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  if (visible.length === 0) return null;

  return (
    <>
      <section className="space-y-4">
        {visible.map((group) => (
          <div key={group.title} className="space-y-2">
            <h2 className="text-sm font-semibold text-ocean-foam">{group.title}</h2>
            <div className={group.pics.length === 1 ? "grid grid-cols-1" : "grid gap-3 md:grid-cols-2"}>
              {group.pics.map((pic) => (
                <button
                  key={pic.filename}
                  type="button"
                  onClick={() => setActive(pic)}
                  className="overflow-hidden rounded-lg border border-ocean-mid/70 bg-white text-left"
                >
                  <img
                    src={picSrc(pic)}
                    alt={pic.label}
                    className="h-auto max-h-[520px] w-full object-contain"
                  />
                  <span className="flex items-center justify-between gap-2 border-t border-ocean-mid/40 px-3 py-2 text-xs text-ocean-sand">
                    <span className="font-medium text-ocean-foam">{pic.label}</span>
                    <span>{pic.timeframe}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {active ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={active.label}
          onClick={() => setActive(null)}
        >
          <div className="max-h-[92vh] max-w-[96vw]" onClick={(event) => event.stopPropagation()}>
            <img
              src={picSrc(active)}
              alt={active.label}
              className="max-h-[86vh] max-w-[96vw] object-contain"
            />
            <p className="mt-2 text-center text-sm text-white">
              {active.label} · {active.timeframe}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
