/**
 * SemiFinal → Ready to monitor (setup-ready, active only).
 * Confirmation watches are started manually — not mixed into Market Alarm UI.
 *
 * Breakout / momentum stays on its own Kanban.
 */
import type { PollIntervalUnit } from "@/shared/components/PollControls";
import type {
  PreselectionCandidateMode,
  PreselectionCandidateRuleRow,
  PreselectionResultResponse,
  PreselectionStrategyGroup,
  PreselectionTickerRow,
} from "@/features/admin/setup-scan/types";
import type { AlarmEligibleRuleKey } from "@/features/market/alarm/alarm-types";

export type SemifinalMonitorCandidate = {
  id: string;
  symbol: string;
  name?: string | null;
  strategyId: string;
  strategyName: string;
  directionBias: "CALL" | "PUT" | null;
  confirmRuleKey: AlarmEligibleRuleKey;
  confirmLabel: string;
  /** First confirm check clock (display), e.g. 09:31 for E01 gap. */
  startEt: string;
  /** Human schedule: 9:31 then hourly from 10:00, etc. */
  scheduleSummary: string;
  frequencyValue: number;
  frequencyUnit: PollIntervalUnit;
  setupMet: string[];
  waitingFor: string;
  setupSummary: string;
  mode: PreselectionCandidateMode | string;
};

export type SemifinalMonitorGroup = {
  confirmRuleKey: AlarmEligibleRuleKey;
  confirmLabel: string;
  strategyIds: string[];
  strategyNames: string[];
  startEt: string;
  scheduleSummary: string;
  frequencyValue: number;
  frequencyUnit: PollIntervalUnit;
  candidates: SemifinalMonitorCandidate[];
};

type StrategyConfirmPolicy = {
  ruleKey: AlarmEligibleRuleKey;
  label: string;
  startEt: string;
  scheduleSummary: string;
  frequencyValue: number;
  frequencyUnit: PollIntervalUnit;
  waitingFor: string;
  /** Never required for “ready to monitor” admission. */
  ignoreRuleKeys: string[];
};

/** Confirm/vol extras — setup eligibility ignores these. */
const DEFAULT_IGNORE = [
  "confirmation_change_trend_1h",
  "confirmation_change_trend_15m",
  "volume_stoch_1h",
  "daily_ma_bounce_confirm_1h",
  "bb_mid_bounce_signal_15m",
  "vol_bb_expand_1h",
  "vol_bb_expand_15m",
];

const CONFIRM_BY_STRATEGY: Record<string, StrategyConfirmPolicy> = {
  "estrategia-01": {
    ruleKey: "confirmation_change_trend_1h",
    label: "Confirmación E01",
    startEt: "09:31",
    scheduleSummary: "Every hour from 9:31 ET until 4:00 PM (gap at 9:31, then hourly)",
    frequencyValue: 1,
    frequencyUnit: "hour",
    waitingFor:
      "confirmation_change_trend_1h — 1h confirm candle + mid/trendline + 15m mid + VWAP (gap may met at 9:31)",
    ignoreRuleKeys: DEFAULT_IGNORE,
  },
  "estrategia-02": {
    ruleKey: "daily_ma_bounce_confirm_1h",
    label: "Confirmación E02",
    startEt: "10:00",
    scheduleSummary: "Every hour from 10:00 ET until 4:00 PM",
    frequencyValue: 1,
    frequencyUnit: "hour",
    waitingFor: "daily_ma_bounce_confirm_1h — Confirmación entrada rebote MA20 (HORA)",
    ignoreRuleKeys: DEFAULT_IGNORE,
  },
  "estrategia-03": {
    ruleKey: "volume_stoch_1h",
    label: "Confirmación E03",
    startEt: "09:31",
    scheduleSummary: "Every 30s from 9:31–9:45 ET (Magnet Effect — stops at 9:45)",
    frequencyValue: 30,
    frequencyUnit: "sec",
    waitingFor: "volume_stoch_1h — Volumen HORA cruza línea roja (Worden Stochastics)",
    ignoreRuleKeys: DEFAULT_IGNORE,
  },
};

export function confirmPolicyForStrategy(
  strategyId: string,
): StrategyConfirmPolicy | null {
  return CONFIRM_BY_STRATEGY[String(strategyId || "")] ?? null;
}

/** Active + setup prerequisites met (confirm + vol ignored) for this strategy. */
export function tickerReadyForConfirmMonitor(
  strategyId: string,
  ticker: PreselectionTickerRow,
  opts?: {
    strategyName?: string;
    mode?: PreselectionCandidateMode | string;
  },
): SemifinalMonitorCandidate | null {
  const policy = confirmPolicyForStrategy(strategyId);
  if (!policy) return null;
  if (!ticker?.symbol || !ticker.currentlyActive) return null;
  if (!setupReady(ticker, policy)) return null;

  const biasRaw = String(ticker.directionBias || "").toUpperCase();
  const directionBias =
    biasRaw === "CALL" || biasRaw === "PUT" ? (biasRaw as "CALL" | "PUT") : null;
  const setupMet = setupMetLabels(ticker, policy);
  const sid = String(strategyId);

  return {
    id: `${sid}:${String(ticker.symbol).toUpperCase()}:${policy.ruleKey}`,
    symbol: String(ticker.symbol).toUpperCase(),
    name: ticker.name,
    strategyId: sid,
    strategyName: opts?.strategyName || sid,
    directionBias,
    confirmRuleKey: policy.ruleKey,
    confirmLabel: policy.label,
    startEt: policy.startEt,
    scheduleSummary: policy.scheduleSummary,
    frequencyValue: policy.frequencyValue,
    frequencyUnit: policy.frequencyUnit,
    setupMet,
    waitingFor: policy.waitingFor,
    setupSummary: setupSummary(setupMet),
    mode: opts?.mode ?? "open",
  };
}

function isIgnoredSetupRule(ruleKey: string, policy: StrategyConfirmPolicy): boolean {
  const key = ruleKey.trim();
  if (key === policy.ruleKey) return true;
  return policy.ignoreRuleKeys.includes(key) || key.startsWith("vol_bb_expand_");
}

function setupRules(
  ticker: PreselectionTickerRow,
  policy: StrategyConfirmPolicy,
): PreselectionCandidateRuleRow[] {
  return (ticker.candidateRules ?? []).filter((row) => {
    if (String(row.type || "required") === "bonus") return false;
    if (String(row.status || "") === "skipped") return false;
    const key = String(row.ruleKey || "");
    if (!key) return false;
    return !isIgnoredSetupRule(key, policy);
  });
}

function setupReady(ticker: PreselectionTickerRow, policy: StrategyConfirmPolicy): boolean {
  const rules = setupRules(ticker, policy);
  if (rules.length === 0) {
    // Soft-only / no setup rows — do not arm from score alone.
    return false;
  }
  return rules.every((row) => row.met === true || String(row.status || "") === "met");
}

function setupMetLabels(
  ticker: PreselectionTickerRow,
  policy: StrategyConfirmPolicy,
): string[] {
  return setupRules(ticker, policy)
    .filter((row) => row.met === true || String(row.status || "") === "met")
    .map((row) => row.label || row.ruleKey)
    .filter((x): x is string => Boolean(x));
}

function setupSummary(met: string[]): string {
  if (met.length === 0) return "Setup incomplete";
  const keys = met.slice(0, 3);
  const more = met.length > keys.length ? ` +${met.length - keys.length}` : "";
  return `${keys.join(" · ")}${more}`;
}

export function buildSemifinalMonitorQueue(
  result: PreselectionResultResponse | null | undefined,
): SemifinalMonitorCandidate[] {
  if (!result || !Array.isArray(result.strategies)) return [];
  const mode = result.mode ?? "eod";
  const out: SemifinalMonitorCandidate[] = [];

  for (const group of result.strategies as PreselectionStrategyGroup[]) {
    const strategyId = String(group.strategyId || "");
    if (!confirmPolicyForStrategy(strategyId)) continue;
    const strategyName = group.shortName || group.name || strategyId;

    for (const ticker of group.tickers ?? []) {
      const row = tickerReadyForConfirmMonitor(strategyId, ticker, {
        strategyName,
        mode,
      });
      if (row) out.push(row);
    }
  }

  out.sort((a, b) => {
    const byConfirm = a.confirmLabel.localeCompare(b.confirmLabel);
    if (byConfirm !== 0) return byConfirm;
    const bySym = a.symbol.localeCompare(b.symbol);
    if (bySym !== 0) return bySym;
    return a.strategyId.localeCompare(b.strategyId);
  });
  return out;
}

export function groupSemifinalMonitorQueue(
  candidates: SemifinalMonitorCandidate[],
): SemifinalMonitorGroup[] {
  const map = new Map<string, SemifinalMonitorGroup>();
  for (const row of candidates) {
    const key = row.confirmRuleKey;
    let group = map.get(key);
    if (!group) {
      group = {
        confirmRuleKey: row.confirmRuleKey,
        confirmLabel: row.confirmLabel,
        strategyIds: [],
        strategyNames: [],
        startEt: row.startEt,
        scheduleSummary: row.scheduleSummary,
        frequencyValue: row.frequencyValue,
        frequencyUnit: row.frequencyUnit,
        candidates: [],
      };
      map.set(key, group);
    }
    group.candidates.push(row);
    if (!group.strategyIds.includes(row.strategyId)) {
      group.strategyIds.push(row.strategyId);
      group.strategyNames.push(row.strategyName);
    }
  }
  return [...map.values()].sort((a, b) => a.confirmLabel.localeCompare(b.confirmLabel));
}
