/**
 * Alarm list helpers — persist to Dynamo via API (not localStorage).
 */
import {
  deleteMarketAlarmTriggers,
  fetchMarketAlarmTriggers,
  postMarketAlarmTrigger,
  type MarketAlarmTriggerEntry,
} from "./alarm-client";
import {
  formatAlarmTrend,
  watchRuleKeys,
  type AlarmEligibleRuleKey,
  type AlarmPopupKind,
  type AlarmTrend,
  type MarketAlarmWatch,
} from "./alarm-types";

export const ALARM_TRIGGER_LOG_CHANGED_EVENT = "oceanview.market.alarm.triggers.changed";

export type AlarmTriggerEntry = MarketAlarmTriggerEntry & {
  ruleKeys: AlarmEligibleRuleKey[] | string[];
  side: AlarmTrend | string;
};

function sideOf(watch: MarketAlarmWatch): AlarmTrend {
  if (watch.lastDetectedTrend === "alcista" || watch.lastDetectedTrend === "bajista") {
    return watch.lastDetectedTrend;
  }
  return watch.trend;
}

export function buildTriggerWay(
  watch: MarketAlarmWatch,
  kind: AlarmPopupKind,
  evidence: string | null,
): string {
  const side = sideOf(watch);
  const sideLabel =
    side === "alcista" || side === "bajista" ? formatAlarmTrend(side) : formatAlarmTrend(watch.trend);
  const action = kind === "enter" ? "ENTER" : "EXIT";
  const base = `${action} · ${watch.ruleLabel} · ${sideLabel}`;
  const ev = (evidence || "").trim();
  return ev ? `${base} — ${ev}` : base;
}

function notifyTriggerLogChanged(): void {
  window.dispatchEvent(new CustomEvent(ALARM_TRIGGER_LOG_CHANGED_EVENT));
}

export async function loadAlarmTriggerLog(): Promise<AlarmTriggerEntry[]> {
  const payload = await fetchMarketAlarmTriggers();
  return Array.isArray(payload.entries) ? payload.entries : [];
}

/** Persist ENTER/EXIT to Dynamo (OceanView-JobsStatus · market_alarm_triggers). */
export async function appendAlarmTrigger(
  watch: MarketAlarmWatch,
  kind: AlarmPopupKind,
): Promise<AlarmTriggerEntry> {
  const evidence =
    kind === "enter" ? watch.lastEvidence : (watch.exitEvidence ?? watch.lastEvidence);
  const triggeredAt =
    (kind === "enter" ? watch.metAt : watch.exitedAt) || new Date().toISOString();
  const result = await postMarketAlarmTrigger({
    watchId: watch.id,
    symbol: watch.symbol,
    kind,
    triggeredAt,
    way: buildTriggerWay(watch, kind, evidence),
    ruleLabel: watch.ruleLabel,
    ruleKeys: watchRuleKeys(watch),
    side: sideOf(watch),
    evidence: evidence ?? null,
  });
  notifyTriggerLogChanged();
  return result.entry;
}

export async function clearAlarmTriggerLog(): Promise<void> {
  await deleteMarketAlarmTriggers();
  notifyTriggerLogChanged();
}
