import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/shared/lib/cn";
import type { CatalogTicker } from "./types";

type Props = {
  value: string;
  suggestions: CatalogTicker[];
  disabled?: boolean;
  onChange: (value: string) => void;
  onSelect: (symbol: string) => void;
};

export function TickerCatalogSearch({
  value,
  suggestions,
  disabled,
  onChange,
  onSelect,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const showList = open && value.trim().length > 0 && suggestions.length > 0;

  return (
    <div ref={rootRef} className="relative min-w-0 max-w-sm flex-1">
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ocean-sand"
        aria-hidden
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
            clipRule="evenodd"
          />
        </svg>
      </span>
      <input
        type="search"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }
          if (e.key === "Enter" && suggestions.length > 0) {
            e.preventDefault();
            onSelect(suggestions[0].symbol);
            setOpen(false);
          }
        }}
        placeholder="Search symbol or name…"
        aria-label="Search tickers"
        aria-autocomplete="list"
        aria-controls={showList ? listId : undefined}
        aria-expanded={showList}
        className="w-full rounded-md border border-ocean-mid/40 bg-ocean-surface py-1.5 pl-8 pr-3 text-sm text-ocean-foam placeholder:text-ocean-sand/60 focus:border-ocean-teal/40 focus:outline-none focus:ring-1 focus:ring-ocean-teal/20 disabled:opacity-50"
      />

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-ocean-mid/50 bg-ocean-deep py-1 shadow-lg"
        >
          {suggestions.map((row) => (
            <li key={row.symbol} role="option">
              <button
                type="button"
                className={cn(
                  "flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm",
                  "hover:bg-ocean-teal/15 focus:bg-ocean-teal/15 focus:outline-none",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(row.symbol);
                  setOpen(false);
                }}
              >
                <span className="font-semibold text-ocean-foam">{row.symbol}</span>
                {row.name ? (
                  <span className="truncate text-xs text-ocean-sand">{row.name}</span>
                ) : null}
                <span
                  className={cn(
                    "ml-auto shrink-0 text-[10px] font-medium uppercase",
                    row.active ? "text-ocean-teal-dim dark:text-ocean-teal" : "text-ocean-sand",
                  )}
                >
                  {row.active ? "Active" : "Off"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
