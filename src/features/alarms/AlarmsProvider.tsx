import { createContext, useContext, type ReactNode } from "react";
import { AlarmTradeModal } from "@/features/market/alarm/AlarmTradeModal";
import { useMarketAlarms } from "@/features/market/alarm/useMarketAlarms";

type AlarmsApi = ReturnType<typeof useMarketAlarms>;

const AlarmsContext = createContext<AlarmsApi | null>(null);

export function AlarmsProvider({ children }: { children: ReactNode }) {
  const alarms = useMarketAlarms();

  return (
    <AlarmsContext.Provider value={alarms}>
      {children}
      {alarms.alarmPopup ? (
        <AlarmTradeModal
          watch={alarms.alarmPopup.watch}
          kind={alarms.alarmPopup.kind}
          onClose={alarms.clearAlarmPopup}
          onConfirm={() =>
            alarms.alarmPopup!.kind === "enter"
              ? alarms.confirmEnter(alarms.alarmPopup!.watch.id)
              : alarms.confirmExit(alarms.alarmPopup!.watch.id)
          }
        />
      ) : null}
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
