export type AlarmsTab = "strategy" | "movement";

export const ALARMS_TABS: AlarmsTab[] = ["strategy", "movement"];

export const ALARMS_TAB_LABELS: Record<AlarmsTab, string> = {
  strategy: "Strategy confirms",
  movement: "Movement / Breakout",
};

export function isAlarmsTab(value: string | undefined): value is AlarmsTab {
  return ALARMS_TABS.includes(value as AlarmsTab);
}

export function alarmsPath(tab: AlarmsTab = "strategy"): string {
  return `/alarms/${tab}`;
}

export function defaultAlarmsTab(): AlarmsTab {
  return "strategy";
}
