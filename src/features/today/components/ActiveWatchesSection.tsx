import { AlarmTradeModal } from "@/features/market/alarm/AlarmTradeModal";
import { MarketAlarmPanel } from "@/features/market/alarm/MarketAlarmPanel";
import { useMarketAlarms } from "@/features/market/alarm/useMarketAlarms";
import { TodaySection } from "./TodaySection";

type Alarms = ReturnType<typeof useMarketAlarms>;

type Props = {
  alarms: Alarms;
};

export function ActiveWatchesSection({ alarms }: Props) {
  return (
    <TodaySection
      id="today-active-watches"
      title="Active Watches"
      subtitle="Confirmation and alarm monitoring — same engine as Market → Alarm"
    >
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
      <MarketAlarmPanel
        watches={alarms.watches}
        tickers={alarms.tickers}
        tickersLoading={alarms.tickersLoading}
        tickersError={alarms.tickersError}
        formError={alarms.formError}
        banner={alarms.banner}
        alarmPopup={alarms.alarmPopup}
        metCount={alarms.metCount}
        runningCount={alarms.runningCount}
        timeMode={alarms.timeMode}
        simulateLocal={alarms.simulateLocal}
        onTimeModeChange={alarms.setTimeMode}
        onSimulateLocalChange={alarms.setSimulateLocal}
        onClearBanner={alarms.clearMetBanner}
        onClearAlarmPopup={alarms.clearAlarmPopup}
        onConfirmEnter={alarms.confirmEnter}
        onConfirmExit={alarms.confirmExit}
        onAdd={alarms.addWatch}
        onStart={alarms.startWatch}
        onStop={alarms.stopWatch}
        onStartAllIdle={alarms.startAllIdle}
        onStopAllRunning={alarms.stopAllRunning}
        onClearMetStatus={alarms.clearMetStatus}
        onClearAllMetStatuses={alarms.clearAllMetStatuses}
        onRemove={alarms.removeWatch}
        onCheckNow={(id) => void alarms.runCheckNow(id)}
        onUpdateInterval={alarms.updateWatchInterval}
        onRequestNotify={() => void alarms.requestNotifyPermission()}
      />
    </TodaySection>
  );
}
