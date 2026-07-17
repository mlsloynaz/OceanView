import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import type { AdminPaneId } from "../admin-panes";

type Props = {
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
};

export function AdminPaneThumbnail({ title, description, active, onClick, icon }: Props) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "group flex min-h-[9rem] flex-col rounded-xl border bg-ocean-surface p-4 text-left shadow-sm transition-all sm:p-5",
        active
          ? "border-ocean-teal/60 ring-2 ring-ocean-teal/30"
          : "border-ocean-mid/50 hover:border-ocean-teal/40 hover:bg-ocean-deep/20",
      )}
    >
      <span
        className={cn(
          "mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors",
          active
            ? "border-ocean-teal/40 bg-ocean-teal/15 text-ocean-teal"
            : "border-ocean-mid/40 bg-ocean-deep/40 text-ocean-sand group-hover:text-ocean-foam",
        )}
      >
        {icon}
      </span>
      <span className="font-display text-base font-semibold text-ocean-foam">{title}</span>
      <span className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-ocean-sand">
        {description}
      </span>
    </button>
  );
}

function IconScan() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M3 4.75A2.75 2.75 0 015.75 2h8.5A2.75 2.75 0 0117 4.75v2.5A2.75 2.75 0 0114.25 10h-8.5A2.75 2.75 0 013 7.25v-2.5zM5.75 4.5a.25.25 0 00-.25.25v2.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25v-2.5a.25.25 0 00-.25-.25h-8.5z" />
      <path d="M3 12.25A2.75 2.75 0 015.75 9.5h8.5A2.75 2.75 0 0117 12.25v3A2.75 2.75 0 0114.25 18h-8.5A2.75 2.75 0 013 15.25v-3zm2.75-1.75a.25.25 0 00-.25.25v3c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25v-3a.25.25 0 00-.25-.25h-8.5z" />
    </svg>
  );
}

function IconList() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M6 4.75A.75.75 0 016.75 4h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 4.75zM6 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 10zm0 5.25a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM2.75 4.75a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM2.75 10a.75.75 0 111.5 0 .75.75 0 01-1.5 0zm0 5.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconCandles() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M6.5 3.75A1.75 1.75 0 018.25 2h3.5A1.75 1.75 0 0113.5 3.75v12.5A1.75 1.75 0 0111.75 18h-3.5A1.75 1.75 0 016.5 16.25V3.75zM8.25 3.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h3.5a.25.25 0 00.25-.25V3.75a.25.25 0 00-.25-.25h-3.5z" />
      <path d="M3.5 8.75A1.75 1.75 0 015.25 7h1.5A1.75 1.75 0 018.5 8.75v6.5A1.75 1.75 0 016.75 17h-1.5A1.75 1.75 0 013.5 15.25v-6.5z" />
      <path d="M11.5 6.75A1.75 1.75 0 0113.25 5h1.5A1.75 1.75 0 0116.5 6.75v8.5A1.75 1.75 0 0114.75 17h-1.5A1.75 1.75 0 0111.5 15.25v-8.5z" />
    </svg>
  );
}

function IconStrategy() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M11.3 1.046a1 1 0 011.4 0l2.25 2.25a1 1 0 01.263.868v5.677a2.75 2.75 0 01-1.013 2.122l-4.25 3.404a1 1 0 01-1.25 0l-4.25-3.404A2.75 2.75 0 013.787 9.841V4.164a1 1 0 01.263-.868L6.3 1.046a1 1 0 011.4 0L10 3.347l3.3-2.301zM7 4.662L4.596 6.336v3.505c0 .564.247 1.1.676 1.464L10 14.227l4.728-3.922a1.75 1.75 0 00.676-1.464V6.336L12.3 4.662 10 6.265 7 4.662z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconResearch() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M10 2a.75.75 0 01.75.75v.546a6.75 6.75 0 015.954 5.954h.546a.75.75 0 010 1.5h-.546a6.75 6.75 0 01-5.954 5.954v.546a.75.75 0 01-1.5 0v-.546a6.75 6.75 0 01-5.954-5.954H2.75a.75.75 0 010-1.5h.546A6.75 6.75 0 019.25 3.296V2.75A.75.75 0 0110 2zm0 3.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" />
      <path d="M10 8a2 2 0 100 4 2 2 0 000-4z" />
    </svg>
  );
}

export const ADMIN_PANE_ICONS: Record<AdminPaneId, ReactNode> = {
  "setup-scan": <IconScan />,
  tickers: <IconList />,
  candles: <IconCandles />,
  strategies: <IconStrategy />,
  "research-stats": <IconResearch />,
};
