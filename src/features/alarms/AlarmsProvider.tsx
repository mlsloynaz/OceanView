import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import {
  ALARM_STRIP_CHANNEL,
  alarmStripTags,
  type AlarmStripMessage,
} from "@/features/market/alarm/AlarmSignalStrip";
import { isMovementAlarmWatch } from "@/features/market/alarm/alarm-types";
import { useMarketAlarms } from "@/features/market/alarm/useMarketAlarms";
import {
  MOVEMENT_GRID_CHANNEL,
  type MovementGridActionName,
  type MovementGridMessage,
} from "./movement-grid-channel";

type AlarmsApi = ReturnType<typeof useMarketAlarms>;

const AlarmsContext = createContext<AlarmsApi | null>(null);

function movementGridSnapshot(alarms: AlarmsApi): MovementGridMessage {
  return {
    type: "snapshot",
    watches: alarms.watches.filter(isMovementAlarmWatch),
    tickers: alarms.tickers.map((ticker) => ({
      symbol: ticker.symbol,
      name: ticker.name,
    })),
  };
}

function applyMovementGridAction(alarms: AlarmsApi, action: MovementGridActionName, id: string) {
  switch (action) {
    case "check":
      void alarms.runCheckNow(id);
      return;
    case "start":
      alarms.startWatch(id);
      return;
    case "stop":
      alarms.stopWatch(id);
      return;
    case "remove":
      alarms.removeWatch(id);
      return;
    case "confirmEnter":
      alarms.confirmEnter(id);
      return;
    case "confirmExit":
      alarms.confirmExit(id);
      return;
    case "clear":
      alarms.clearMetStatus(id);
      return;
  }
}

/** Mirrors the live movement grid into the separate graph window. */
function MovementGridSync() {
  const alarms = useAlarms();
  const alarmsRef = useRef(alarms);
  alarmsRef.current = alarms;
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const channel = new BroadcastChannel(MOVEMENT_GRID_CHANNEL);
    channelRef.current = channel;
    const publish = () => {
      try {
        channel.postMessage(movementGridSnapshot(alarmsRef.current));
      } catch {
        // Skip a snapshot that cannot be cloned into the other window.
      }
    };
    const onMessage = (event: MessageEvent<MovementGridMessage>) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "hello") {
        publish();
        return;
      }
      if (data.type === "action" && data.id) {
        applyMovementGridAction(alarmsRef.current, data.action, data.id);
      }
    };
    channel.addEventListener("message", onMessage);
    publish();
    return () => {
      channel.removeEventListener("message", onMessage);
      channel.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;
    try {
      channel.postMessage(movementGridSnapshot(alarmsRef.current));
    } catch {
      // Skip a snapshot that cannot be cloned into the other window.
    }
  }, [alarms.watches, alarms.tickers]);

  return null;
}

/** Publishes the alert strip to graph windows and hides it when they press X. */
function AlarmStripSync() {
  const alarms = useAlarms();
  const alarmsRef = useRef(alarms);
  alarmsRef.current = alarms;

  useEffect(() => {
    const channel = new BroadcastChannel(ALARM_STRIP_CHANNEL);
    const publish = () => {
      channel.postMessage({
        type: "strip",
        tags: alarmStripTags(alarmsRef.current.alarmPopup),
      } satisfies AlarmStripMessage);
    };
    const onMessage = (event: MessageEvent<AlarmStripMessage>) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "hello") publish();
      if (data.type === "dismiss") alarmsRef.current.dismissAlarmPopup();
    };
    channel.addEventListener("message", onMessage);
    publish();
    return () => {
      channel.removeEventListener("message", onMessage);
      channel.close();
    };
  }, []);

  useEffect(() => {
    const channel = new BroadcastChannel(ALARM_STRIP_CHANNEL);
    channel.postMessage({
      type: "strip",
      tags: alarmStripTags(alarms.alarmPopup),
    } satisfies AlarmStripMessage);
    channel.close();
  }, [alarms.alarmPopup]);

  return null;
}

export function AlarmsProvider({ children }: { children: ReactNode }) {
  const alarms = useMarketAlarms();

  return (
    <AlarmsContext.Provider value={alarms}>
      <MovementGridSync />
      <AlarmStripSync />
      {children}
    </AlarmsContext.Provider>
  );
}

export function useAlarms(): AlarmsApi {
  const ctx = useContext(AlarmsContext);
  if (!ctx) {
    throw new Error("useAlarms must be used within AlarmsProvider");
  }
  return ctx;
}
