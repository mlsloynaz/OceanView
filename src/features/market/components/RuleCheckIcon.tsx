import type { RuleStatus } from "../types";
import { ruleStatusTitle } from "../display";
import { cn } from "@/shared/lib/cn";

type Props = {
  status: RuleStatus;
  title?: string;
  className?: string;
  /** Bonus/extra rules use a smaller glyph. */
  size?: "md" | "sm";
};

export function RuleCheckIcon({ status, title, className, size = "md" }: Props) {
  const tip = title ?? ruleStatusTitle(status);
  const sm = size === "sm";

  if (status === "met") {
    return (
      <span
        className={cn(
          "inline-flex font-bold leading-none text-ocean-teal-dim dark:text-ocean-teal",
          sm ? "w-2.5 text-[9px]" : "w-3.5 text-[13px]",
          className,
        )}
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
          "inline-flex shrink-0 items-center justify-center rounded-full bg-sky-500 font-bold leading-none text-white",
          sm ? "h-2.5 w-2.5 text-[6px]" : "h-3.5 w-3.5 text-[7px]",
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
      <span
        className={cn(
          "inline-flex leading-none text-amber-600 dark:text-amber-400",
          sm ? "w-2.5 text-[9px]" : "w-3.5 text-[13px]",
          className,
        )}
        title={tip}
        aria-label={tip}
      >
        ○
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span
        className={cn(
          "inline-flex leading-none text-ocean-sand",
          sm ? "w-2.5 text-[9px]" : "w-3.5",
          className,
        )}
        title={tip}
        aria-label={tip}
      >
        ·
      </span>
    );
  }

  if (status === "not_met") {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center",
          sm ? "h-2.5 w-2.5" : "h-3.5 w-3.5",
          className,
        )}
        title={tip}
        aria-label={tip}
      >
        <span
          className={cn(
            "rounded-full bg-orange-500 dark:bg-orange-400",
            sm ? "h-1.5 w-1.5" : "h-2.5 w-2.5",
          )}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex leading-none text-ocean-sand",
        sm ? "w-2.5 text-[9px]" : "w-3.5",
        className,
      )}
      title={tip}
      aria-label={tip}
    >
      ·
    </span>
  );
}
