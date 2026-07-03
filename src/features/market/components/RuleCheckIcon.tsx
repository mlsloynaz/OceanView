import type { RuleStatus } from "../types";
import { ruleStatusTitle } from "../display";
import { cn } from "@/shared/lib/cn";

type Props = {
  status: RuleStatus;
  title?: string;
  className?: string;
};

export function RuleCheckIcon({ status, title, className }: Props) {
  const tip = title ?? ruleStatusTitle(status);

  if (status === "met") {
    return (
      <span
        className={cn("inline-flex w-3.5 font-bold leading-none text-ocean-teal-dim dark:text-ocean-teal", className)}
        title={tip}
        aria-label={tip}
      >
        ✓
      </span>
    );
  }

  if (status === "about_to_cross") {
    return (
      <span
        className={cn(
          "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[7px] font-bold leading-none text-white",
          className,
        )}
        title={tip}
        aria-label={tip}
      >
        G
      </span>
    );
  }

  if (status === "partial") {
    return (
      <span className={cn("inline-flex w-3.5 leading-none text-amber-600 dark:text-amber-400", className)} title={tip} aria-label={tip}>
        ○
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span className={cn("inline-flex w-3.5 leading-none text-ocean-sand", className)} title={tip} aria-label={tip}>
        ·
      </span>
    );
  }

  if (status === "not_met") {
    return (
      <span
        className={cn(
          "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center",
          className,
        )}
        title={tip}
        aria-label={tip}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-orange-500 dark:bg-orange-400" />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex w-3.5 leading-none text-ocean-sand", className)} title={tip} aria-label={tip}>
      ·
    </span>
  );
}
