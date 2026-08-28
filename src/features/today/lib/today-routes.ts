/** Today is Live (Market) only — Premarket stays on `/premarket`. */

export type TodayMode = "live";

export const TODAY_MODES: TodayMode[] = ["live"];

export const TODAY_MODE_LABELS: Record<TodayMode, string> = {
  live: "Live",
};

export function isTodayMode(value: string | undefined): value is TodayMode {
  return TODAY_MODES.includes(value as TodayMode);
}

export function todayPath(mode: TodayMode = "live"): string {
  return `/today/${mode}`;
}

export function defaultTodayMode(): TodayMode {
  return "live";
}
