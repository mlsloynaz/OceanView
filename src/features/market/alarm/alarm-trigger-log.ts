/**
 * Alarm list helpers — persist to Dynamo via API (not localStorage).
 */
import {
  deleteMarketAlarmTriggers,
  fetchMarketAlarmTriggers,
  postMarketAlarmTrigger,
  type MarketAlarmTriggerEntry,
} from "./alarm-client";
import { formatTopRatedLine } from "./alarm-enter-pool";
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
  topRatedSymbol?: string;
  topRatedEarningPct?: number | null;
};

export type AppendAlarmTriggerOpts = {
  topRatedSymbol?: string;
  topRatedEarningPct?: number | null;
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
  opts?: AppendAlarmTriggerOpts,
): string {
  const side = sideOf(watch);
  const sideLabel =
    side === "alcista" || side === "bajista" ? formatAlarmTrend(side) : formatAlarmTrend(watch.trend);
  const action = kind === "enter" ? "ENTER" : "EXIT";
  const base = `${action} · ${watch.ruleLabel} · ${sideLabel}`;
  const ev = (evidence || "").trim();
  let way = ev ? `${base} — ${ev}` : base;
  const topSym = opts?.topRatedSymbol?.trim();
  if (
    kind === "enter" &&
    topSym &&
    topSym.toUpperCase() !== watch.symbol.trim().toUpperCase()
  ) {
    way = `${way} · ${formatTopRatedLine(topSym, opts?.topRatedEarningPct)}`;
  }
  return way;
}

function notifyTriggerLogChanged(): void {
  window.dispatchEvent(new CustomEvent(ALARM_TRIGGER_LOG_CHANGED_EVENT));
}

export async function loadAlarmTriggerLog(week?: string): Promise<{
  entries: AlarmTriggerEntry[];
  weekStart: string | null;
}> {
  const payload = await fetchMarketAlarmTriggers(week);
  return {
    entries: Array.isArray(payload.entries) ? payload.entries : [],
    weekStart: payload.weekStart ?? null,
  };
}

/** Persist ENTER/EXIT to Dynamo (OceanView-JobsStatus · market_alarm_triggers). */
export async function appendAlarmTrigger(
  watch: MarketAlarmWatch,
  kind: AlarmPopupKind,
  opts?: AppendAlarmTriggerOpts,
): Promise<AlarmTriggerEntry> {
  const evidence =
    kind === "enter" ? watch.lastEvidence : (watch.exitEvidence ?? watch.lastEvidence);
  const triggeredAt =
    (kind === "enter" ? watch.metAt : watch.exitedAt) || new Date().toISOString();
  const topRatedSymbol =
    kind === "enter" &&
    opts?.topRatedSymbol &&
    opts.topRatedSymbol.trim().toUpperCase() !== watch.symbol.trim().toUpperCase()
      ? opts.topRatedSymbol.trim().toUpperCase()
      : undefined;
  const topRatedEarningPct = topRatedSymbol ? (opts?.topRatedEarningPct ?? null) : undefined;
  const result = await postMarketAlarmTrigger({
    watchId: watch.id,
    symbol: watch.symbol,
    kind,
    triggeredAt,
    way: buildTriggerWay(watch, kind, evidence, opts),
    ruleLabel: watch.ruleLabel,
    ruleKeys: watchRuleKeys(watch),
    side: sideOf(watch),
    evidence: evidence ?? null,
    ...(topRatedSymbol
      ? { topRatedSymbol, topRatedEarningPct: topRatedEarningPct ?? null }
      : {}),
  });
  notifyTriggerLogChanged();
  return {
    ...result.entry,
    ...(topRatedSymbol
      ? { topRatedSymbol, topRatedEarningPct: topRatedEarningPct ?? null }
      : {}),
  };
}

export async function clearAlarmTriggerLog(): Promise<void> {
  await deleteMarketAlarmTriggers();
  notifyTriggerLogChanged();
}
