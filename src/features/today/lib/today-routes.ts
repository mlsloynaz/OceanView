export type TodayMode = "preparation" | "live" | "replay";

export const TODAY_MODES: TodayMode[] = ["preparation", "live", "replay"];

export const TODAY_MODE_LABELS: Record<TodayMode, string> = {
  preparation: "Preparation",
  live: "Live",
  replay: "Replay",
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
