import type { MarketAlarmWatch } from "@/features/market/alarm/alarm-types";

export const MOVEMENT_GRID_CHANNEL = "oceanview-movement-grid";
export const MOVEMENT_GRID_WINDOW_NAME = "oceanview-movement-grid";

export type MovementGridTicker = {
  symbol: string;
  name: string | null;
};

export type MovementGridActionName =
  | "check"
  | "start"
  | "stop"
  | "remove"
  | "confirmEnter"
  | "confirmExit"
  | "clear";

export type MovementGridSnapshot = {
  type: "snapshot";
  watches: MarketAlarmWatch[];
  tickers: MovementGridTicker[];
};

export type MovementGridMessage =
  | { type: "hello" }
  | MovementGridSnapshot
  | { type: "action"; action: MovementGridActionName; id: string };

export function movementGridWindowUrl(): string {
  return `${window.location.origin}/alarms/grid`;
}

/** Opens or focuses the movement graph grid. Returns false when the browser blocks the pop-up. */
export function openMovementGridWindow(): boolean {
  const opened = window.open(
    movementGridWindowUrl(),
    MOVEMENT_GRID_WINDOW_NAME,
    "popup=yes,width=1440,height=900",
  );
  if (!opened || opened.closed) return false;
  opened.focus();
  return true;
}
