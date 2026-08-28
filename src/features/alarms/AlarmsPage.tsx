import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MarketAlarmPanel } from "@/features/market/alarm/MarketAlarmPanel";
import { useAlarms } from "./AlarmsProvider";
import { AlarmsTabToggle } from "./AlarmsTabToggle";
import {
  ALARMS_TAB_LABELS,
  alarmsPath,
  defaultAlarmsTab,
  isAlarmsTab,
  type AlarmsTab,
} from "./lib/alarm-routes";

export function AlarmsPage() {
  const { tab: tabParam } = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const alarms = useAlarms();

  useEffect(() => {
    if (!isAlarmsTab(tabParam)) {
      navigate(alarmsPath(defaultAlarmsTab()), { replace: true });
    }
  }, [tabParam, navigate]);

  const tab: AlarmsTab = isAlarmsTab(tabParam) ? tabParam : defaultAlarmsTab();

  const setTab = (next: AlarmsTab) => {
    navigate(alarmsPath(next));
  };

  return (
    <div className="w-full space-y-4">
      <div className="space-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold text-ocean-foam sm:text-2xl">
            Alarms
          </h1>
          <p className="mt-1 text-sm text-ocean-sand">
            Strategy confirmation watches and movement / breakout alarms — off the Live page.
            {tab === "strategy"
              ? " Add from SemiFinal (Monitor), then Start polling on each watch."
              : " Breakout quality Kanban and disipador / momentum watches."}
          </p>
        </div>
        <AlarmsTabToggle tab={tab} onChange={setTab} />
      </div>

      <MarketAlarmPanel
        section={tab}
        title={ALARMS_TAB_LABELS[tab]}
        watches={alarms.watches}
        tickers={alarms.tickers}
        tickersLoading={alarms.tickersLoading}
        tickersError={alarms.tickersError}
        formError={alarms.formError}
        banner={alarms.banner}
        alarmPopup={null}
        metCount={alarms.metCount}
        runningCount={alarms.runningCount}
        timeMode={alarms.timeMode}
        simulateLocal={alarms.simulateLocal}
        lastHourScan={alarms.lastHourScan}
        lastHourScanError={alarms.lastHourScanError}
        lastHourScanBusy={alarms.lastHourScanBusy}
        onTimeModeChange={alarms.setTimeMode}
        onSimulateLocalChange={alarms.setSimulateLocal}
        onScanLastHourRth={(symbol) => void alarms.scanLastHourRth(symbol)}
        onClearLastHourScan={alarms.clearLastHourScan}
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
        orbAutoJob={alarms.orbAutoJob}
        onCancelOrbAuto={() => void alarms.cancelOrbAutoJob()}
      />
    </div>
  );
}
