import type { RuleDisplayRow, TradeDirection } from "@/features/market/types";
import { qualityBadgeClass, normalizeRuleStatus } from "@/features/market/display";
import { formatAchievedTimeEt } from "@/features/market/display";
import { evalDedupeKey } from "@/shared/lib/rule-dedupe";
import type {
  PremarketBestHit,
  PremarketBestResultRow,
  PremarketRuleRow,
  PremarketStrategyGroup,
  PremarketStrategyScore,
  PremarketTickerHit,
} from "./types";

export { qualityBadgeClass, formatAchievedTimeEt };

export function formatPremarketStatus(status: string | undefined): string {
  if (!status) return "Unknown";
  switch (status.toLowerCase()) {
    case "complete":
      return "Complete";
    case "partial":
      return "Partial";
    case "stopped":
      return "Stopped";
    case "failed":
      return "Failed";
    case "running":
      return "Running";
    case "ready":
      return "Early results";
    case "stopping":
      return "Stopping";
    case "idle":
      return "Idle";
    default:
      return status;
  }
}

export function isPremarketEvaluateActive(status: string | undefined): boolean {
  const value = (status ?? "").toLowerCase();
  return value === "running" || value === "ready" || value === "stopping";
}

export function isPremarketEvaluateTerminal(status: string | undefined): boolean {
  const value = (status ?? "").toLowerCase();
  return value === "complete" || value === "partial" || value === "failed" || value === "stopped";
}

export function canStopPremarketEvaluate(
  status: string | undefined,
  startPending: boolean,
  canStopFromApi?: boolean,
): boolean {
  if (startPending) return true;
  if (canStopFromApi === true) return true;
  if (canStopFromApi === false) return false;
  return isPremarketEvaluateActive(status);
}

export function formatSimTimeEt(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "shortGeneric",
    });
  } catch {
    return iso;
  }
}

export function toPremarketDisplayRules(
  rules: PremarketRuleRow[] | undefined,
): RuleDisplayRow[] {
  if (!rules?.length) return [];
  const seen = new Set<string>();
  const rows: RuleDisplayRow[] = [];
  for (const row of rules) {
    const dedupeKey = evalDedupeKey({
      ruleKey: row.ruleKey,
      trend: row.trend,
      operation: row.operation,
    });
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    rows.push({
      ruleKey: row.ruleKey,
      label: row.label,
      type: row.type as RuleDisplayRow["type"],
      status: normalizeRuleStatus(row.status),
      metAtEt: row.metAtEt,
      evidence: row.evidence,
      suggestedTrend: row.suggestedTrend,
      suggestedDirection: row.suggestedDirection,
    });
  }
  return rows;
}

export function strategyGroupSubtitle(
  strategyId: string,
  tickerCount: number,
  threshold: number,
): string {
  const countLabel = `${tickerCount} ticker${tickerCount === 1 ? "" : "s"}`;
  if (threshold > 0) {
    return `${strategyId} · ${countLabel} ≥ ${threshold}%`;
  }
  return `${strategyId} · ${countLabel}`;
}

function strategyLabel(group: PremarketStrategyGroup): string {
  return group.shortName || group.name || group.strategyId;
}

function bestHitDedupeKey(symbol: string, direction: TradeDirection | null | undefined): string {
  return `${symbol.toUpperCase()}|${direction ?? "NONE"}`;
}

/**
 * Flatten strategy groups into top-N hits by max qualityPct.
 * Same symbol + direction across strategies merges into one row; each strategy keeps its %.
 */
export function buildPremarketBestResults(
  strategies: PremarketStrategyGroup[],
  limit = 10,
): PremarketBestHit[] {
  type Acc = {
    symbol: string;
    name?: string | null;
    direction: TradeDirection | null | undefined;
    qualityPct: number;
    strategies: PremarketStrategyScore[];
    bestGroup: PremarketStrategyGroup;
    bestTicker: PremarketTickerHit;
  };

  const byKey = new Map<string, Acc>();

  for (const group of strategies) {
    const label = strategyLabel(group);
    for (const ticker of group.tickers) {
      const key = bestHitDedupeKey(ticker.symbol, ticker.direction);
      const score: PremarketStrategyScore = {
        strategyId: group.strategyId,
        label,
        qualityPct: ticker.qualityPct,
      };
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          symbol: ticker.symbol,
          name: ticker.name,
          direction: ticker.direction,
          qualityPct: ticker.qualityPct,
          strategies: [score],
          bestGroup: group,
          bestTicker: ticker,
        });
        continue;
      }
      existing.strategies.push(score);
      if (ticker.qualityPct > existing.qualityPct) {
        existing.qualityPct = ticker.qualityPct;
        existing.bestGroup = group;
        existing.bestTicker = ticker;
        if (ticker.name) existing.name = ticker.name;
      } else if (!existing.name && ticker.name) {
        existing.name = ticker.name;
      }
    }
  }

  return [...byKey.values()]
    .map((row) => ({
      ...row,
      strategies: [...row.strategies].sort(
        (a, b) => b.qualityPct - a.qualityPct || a.label.localeCompare(b.label),
      ),
    }))
    .sort(
      (a, b) =>
        b.qualityPct - a.qualityPct ||
        a.symbol.localeCompare(b.symbol) ||
        String(a.direction ?? "").localeCompare(String(b.direction ?? "")),
    )
    .slice(0, limit);
}

export function formatStrategyScores(scores: PremarketStrategyScore[]): string {
  return scores.map((s) => `${s.label} ${s.qualityPct}%`).join(" · ");
}

function directionKey(direction: TradeDirection | null | undefined): string {
  return direction ?? "NONE";
}

function attachBestHitRefs(
  row: PremarketBestResultRow,
  strategies: PremarketStrategyGroup[],
): PremarketBestHit {
  const ranked = [...row.strategies].sort(
    (a, b) => b.qualityPct - a.qualityPct || a.label.localeCompare(b.label),
  );
  const top = ranked[0];
  const group =
    strategies.find((g) => g.strategyId === top?.strategyId) ??
    strategies.find((g) =>
      g.tickers.some(
        (t) =>
          t.symbol.toUpperCase() === row.symbol.toUpperCase() &&
          directionKey(t.direction) === directionKey(row.direction),
      ),
    ) ?? {
      strategyId: top?.strategyId ?? "",
      name: top?.label,
      shortName: top?.label,
      tickers: [],
    };

  const tickerFromGroup = group.tickers.find(
    (t) =>
      t.symbol.toUpperCase() === row.symbol.toUpperCase() &&
      directionKey(t.direction) === directionKey(row.direction),
  );

  const bestTicker: PremarketTickerHit = {
    ...(tickerFromGroup ?? {
      symbol: row.symbol,
      name: row.name,
      direction: row.direction,
      qualityPct: row.qualityPct,
    }),
    symbol: row.symbol,
    name: row.name ?? tickerFromGroup?.name,
    direction: row.direction ?? tickerFromGroup?.direction,
    qualityPct: row.qualityPct,
  };

  return {
    symbol: row.symbol,
    name: row.name,
    direction: row.direction,
    qualityPct: row.qualityPct,
    strategies: ranked.length ? ranked : row.strategies,
    bestGroup: group,
    bestTicker,
  };
}

/**
 * Prefer API `bestResults` (BestResult feature); fall back to client aggregation
 * for older runs that lack the field.
 */
export function resolvePremarketBestHits(
  strategies: PremarketStrategyGroup[],
  bestResults?: PremarketBestResultRow[] | null,
  limit = 10,
): PremarketBestHit[] {
  if (bestResults && bestResults.length > 0) {
    return bestResults.slice(0, limit).map((row) => attachBestHitRefs(row, strategies));
  }
  return buildPremarketBestResults(strategies, limit);
}
