import { cn } from "@/shared/lib/cn";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function MarketSearchInput({ value, onChange, placeholder, className }: Props) {
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ocean-sand" aria-hidden>
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
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search…"}
        className="w-full max-w-md rounded-md border border-ocean-mid/40 bg-ocean-surface py-1.5 pl-8 pr-3 text-sm text-ocean-foam placeholder:text-ocean-sand/60 focus:border-ocean-teal/40 focus:outline-none focus:ring-1 focus:ring-ocean-teal/20"
      />
    </div>
  );
}
