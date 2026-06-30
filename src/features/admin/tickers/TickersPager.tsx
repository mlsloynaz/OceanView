import { cn } from "@/shared/lib/cn";

type Props = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
};

export function TickersPager({
  page,
  totalPages: pages,
  totalItems,
  pageSize,
  disabled,
  onPageChange,
}: Props) {
  if (totalItems === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-[11px] text-ocean-sand/80">
        {start}–{end} of {totalItems}
        {pages > 1 ? ` · page ${page} / ${pages}` : ""}
      </p>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={cn(
            "rounded border border-ocean-mid/60 px-2 py-0.5 text-xs font-medium text-ocean-foam",
            "hover:border-ocean-teal/50 disabled:opacity-40",
          )}
        >
          Prev
        </button>
        <button
          type="button"
          disabled={disabled || page >= pages}
          onClick={() => onPageChange(page + 1)}
          className={cn(
            "rounded border border-ocean-mid/60 px-2 py-0.5 text-xs font-medium text-ocean-foam",
            "hover:border-ocean-teal/50 disabled:opacity-40",
          )}
        >
          Next
        </button>
      </div>
    </div>
  );
}
