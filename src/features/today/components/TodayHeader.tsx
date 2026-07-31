import { TODAY_MODE_LABELS, type TodayMode } from "../lib/today-routes";

type Props = {
  mode: TodayMode;
  activeWatchCount: number;
  candidateCount: number;
  onRefresh?: () => void;
  refreshPending?: boolean;
};

function formatSessionDate(now = new Date()): string {
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });
}

function formatRefreshTime(now = new Date()): string {
  return now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
}

export function TodayHeader({
  mode,
  activeWatchCount,
  candidateCount,
  onRefresh,
  refreshPending,
}: Props) {
  const dateLabel = formatSessionDate();
  const refreshLabel = formatRefreshTime();

  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold text-ocean-foam sm:text-2xl">Today</h1>
          <p className="mt-1 text-sm text-ocean-sand">
            {dateLabel} · Mode: {TODAY_MODE_LABELS[mode]}
          </p>
        </div>
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshPending}
            className="rounded-md border border-ocean-mid/50 px-3 py-1.5 text-xs font-semibold text-ocean-sand hover:bg-ocean-mid/40 disabled:opacity-50"
          >
            {refreshPending ? "Refreshing…" : "Refresh"}
          </button>
        ) : null}
      </div>

      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ocean-sand/90">
        <div className="flex gap-1.5">
          <dt className="text-ocean-sand/60">Last refresh</dt>
          <dd className="font-medium text-ocean-foam">{refreshLabel}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-ocean-sand/60">Top candidates</dt>
          <dd className="font-medium text-ocean-foam">{candidateCount}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-ocean-sand/60">Active watches</dt>
          <dd className="font-medium text-ocean-foam">{activeWatchCount}</dd>
        </div>
      </dl>
    </header>
  );
}
