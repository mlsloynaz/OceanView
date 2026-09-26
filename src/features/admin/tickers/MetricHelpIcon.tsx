import { cn } from "@/shared/lib/cn";

type Props = {
  label: string;
  meaning: string;
  onOpen: () => void;
  className?: string;
};

/** Small “?” that shows a hover tip and opens the full glossary on click. */
export function MetricHelpIcon({ label, meaning, onOpen, className }: Props) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={meaning}
      aria-label={`What ${label} means`}
      className={cn(
        "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full",
        "border border-ocean-sand/45 text-[9px] font-bold leading-none text-ocean-sand",
        "hover:border-ocean-teal hover:text-ocean-teal focus:outline-none",
        "focus-visible:ring-1 focus-visible:ring-ocean-teal",
        className,
      )}
    >
      ?
    </button>
  );
}

type HeaderProps = {
  label: string;
  meaning: string;
  onOpen: () => void;
};

export function MetricHelpTh({ label, meaning, onOpen }: HeaderProps) {
  return (
    <th className="px-2 py-1.5 font-medium">
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        {label}
        <MetricHelpIcon label={label} meaning={meaning} onOpen={onOpen} />
      </span>
    </th>
  );
}
