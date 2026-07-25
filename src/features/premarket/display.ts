import type { DangerEval, RuleDisplayRow, TradeDirection } from "@/features/market/types";
import {
  normalizeDisplayRuleType,
  normalizeRuleStatus,
  qualityBadgeClass,
  sortRulesForDisplay,
} from "@/features/market/display";
import { formatAchievedTimeEt } from "@/features/market/display";
import { evalDedupeKey } from "@/shared/lib/rule-dedupe";
import type {
  BestResultMonitorTicker,
  BestResultStrikePick,
  MovementProfile,
  PremarketBestHit,
  PremarketBestResultRow,
  PremarketRuleRow,
  PremarketStrategyGroup,
  PremarketStrategyScore,
  PremarketTickerHit,
} from "./types";

export { qualityBadgeClass, formatAchievedTimeEt };

function isPositivePrice(n: number | null | undefined): n is number {
  return typeof n === "number" && !Number.isNaN(n) && n > 0;
}

function pushUniquePrice(out: number[], n: number | null | undefined): void {
  if (!isPositivePrice(n)) return;
  const rounded = Math.round(n * 100) / 100;
  if (out.some((x) => Math.abs(x - rounded) < 0.005)) return;
  out.push(rounded);
}

function clearPathDanger(dangers: DangerEval[] | null | undefined): DangerEval | null {
  return dangers?.find((d) => d.dangerKey === "clear_path") ?? null;
}

/** True when Camino libre (clear_path) passed — a single free-path exit is enough. */
export function isCaminoLibreViable(dangers: DangerEval[] | null | undefined): boolean {
  return clearPathDanger(dangers)?.status === "passed";
}

export function formatMoneyPrice(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Comma-separated stock prices: `$120.50, $122.00, $125.30`. */
export function formatMoneyPriceList(prices: number[]): string {
  return prices.map(formatMoneyPrice).join(", ");
}

export type PremarketPriceLines = {
  currentPrice: number | null;
  /** Ordered exits; last is movement-profile estimate when available. */
  expectedExits: number[];
  caminoLibreViable: boolean;
};

/**
 * Current spot + expected exit targets for Best-results chips / movement panel.
 * When Camino libre is not viable, include obstacle / structure levels and put the
 * movement-profile estimate last. When viable, prefer a single free-path exit.
 */
export function resolvePremarketPriceLines(args: {
  monitor?: BestResultMonitorTicker | null;
  profile?: MovementProfile | null;
  dangers?: DangerEval[] | null;
}): PremarketPriceLines {
  const { monitor, profile, dangers } = args;
  const clearPath = clearPathDanger(dangers);
  const caminoLibreViable = clearPath?.status === "passed";

  const currentPrice =
    (isPositivePrice(monitor?.spot) && monitor.spot) ||
    (isPositivePrice(profile?.referencePrice) && profile.referencePrice) ||
    null;

  const profileExit =
    (isPositivePrice(profile?.expectedExitPrice) && profile.expectedExitPrice) ||
    (isPositivePrice(monitor?.estimate?.expectedExitPrice) &&
      monitor.estimate.expectedExitPrice) ||
    null;

  const explicit =
    monitor?.expectedExitPrices?.filter(isPositivePrice) ??
    profile?.expectedExitPrices?.filter(isPositivePrice) ??
    null;
  if (explicit && explicit.length > 0) {
    const exits: number[] = [];
    for (const p of explicit) pushUniquePrice(exits, p);
    if (profileExit != null) {
      // Keep movement-profile estimate last even if API listed it earlier.
      const withoutProfile = exits.filter((p) => Math.abs(p - profileExit) >= 0.005);
      withoutProfile.push(Math.round(profileExit * 100) / 100);
      return { currentPrice, expectedExits: withoutProfile, caminoLibreViable };
    }
    return { currentPrice, expectedExits: exits, caminoLibreViable };
  }

  const structure: number[] = [];
  for (const obs of clearPath?.obstacles ?? []) {
    pushUniquePrice(structure, obs.level);
  }
  pushUniquePrice(structure, monitor?.expectedExitPrice);
  pushUniquePrice(structure, monitor?.stretchExitPrice);
  pushUniquePrice(structure, profile?.stretchExitPrice);
  // targetSpot is the move-cap projection — include only when Camino libre failed
  // so the chip shows alternate exits before the profile estimate.
  if (!caminoLibreViable) {
    pushUniquePrice(structure, monitor?.targetSpot);
    pushUniquePrice(structure, monitor?.estimate?.targetSpot);
  }

  if (caminoLibreViable) {
    const single: number[] = [];
    if (structure.length > 0) pushUniquePrice(single, structure[0]);
    else if (profileExit != null) pushUniquePrice(single, profileExit);
    return { currentPrice, expectedExits: single, caminoLibreViable };
  }

  const exits = [...structure];
  if (profileExit != null) {
    const withoutProfile = exits.filter((p) => Math.abs(p - profileExit) >= 0.005);
    withoutProfile.push(Math.round(profileExit * 100) / 100);
    return { currentPrice, expectedExits: withoutProfile, caminoLibreViable };
  }
  return { currentPrice, expectedExits: exits, caminoLibreViable };
}

export type BestResultTradeSummary = {
  currentPrice: number | null;
  /** Movement-profile expected exit (stock). */
  estimatedExit: number | null;
  /** Primary Camino libre obstacle level (e.g. MA20). */
  estimatedObstacle: number | null;
  obstacleLabel: string | null;
  suggestedStrike: number | null;
  strikeExpiration: string | null;
  strikeAsk: number | null;
};

/**
 * Compact Best Results trade lines: spot, profile exit, Camino obstacle, option pick.
 */
export function resolveBestResultTradeSummary(args: {
  monitor?: BestResultMonitorTicker | null;
  profile?: MovementProfile | null;
  dangers?: DangerEval[] | null;
  /** Assess/refresh pick when monitor session has not loaded yet. */
  pick?: BestResultStrikePick | null;
  spot?: number | null;
}): BestResultTradeSummary {
  const { monitor, profile, dangers } = args;
  const lines = resolvePremarketPriceLines({ monitor, profile, dangers });
  const currentPrice =
    lines.currentPrice ??
    (isPositivePrice(args.spot) ? args.spot : null) ??
    (isPositivePrice(monitor?.spot) ? monitor.spot : null);

  const estimatedExit =
    (isPositivePrice(profile?.expectedExitPrice) && profile.expectedExitPrice) ||
    (isPositivePrice(monitor?.estimate?.expectedExitPrice) &&
      monitor.estimate.expectedExitPrice) ||
    (isPositivePrice(monitor?.expectedExitPrice) && monitor.expectedExitPrice) ||
    null;

  const clearPath = clearPathDanger(dangers);
  const primaryObstacle =
    clearPath?.obstacles?.find((o) => isPositivePrice(o.level)) ??
    clearPath?.obstacles?.[0] ??
    null;
  const estimatedObstacle =
    primaryObstacle && isPositivePrice(primaryObstacle.level)
      ? primaryObstacle.level
      : null;
  const obstacleLabel =
    primaryObstacle?.label?.trim() ||
    primaryObstacle?.key?.trim() ||
    (estimatedObstacle != null ? "Camino libre" : null);

  const pick = monitor?.pick ?? args.pick ?? null;
  const suggestedStrike =
    typeof pick?.strike === "number" && !Number.isNaN(pick.strike) ? pick.strike : null;

  return {
    currentPrice,
    estimatedExit,
    estimatedObstacle,
    obstacleLabel,
    suggestedStrike,
    strikeExpiration: pick?.expiration?.trim() || null,
    strikeAsk: typeof pick?.ask === "number" && !Number.isNaN(pick.ask) ? pick.ask : null,
  };
}

/** Profile (or resolved) estimated exit only — for non–Best Results panes. */
export function resolveEstimatedExitPrice(args: {
  monitor?: BestResultMonitorTicker | null;
  profile?: MovementProfile | null;
  dangers?: DangerEval[] | null;
}): number | null {
  const profileExit =
    (isPositivePrice(args.profile?.expectedExitPrice) && args.profile.expectedExitPrice) ||
    null;
  if (profileExit != null) return profileExit;
  const { expectedExits } = resolvePremarketPriceLines(args);
  return expectedExits.length > 0 ? expectedExits[expectedExits.length - 1]! : null;
}

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
      type: normalizeDisplayRuleType(row.type) === "extra" ? "extra" : "required",
      status: normalizeRuleStatus(row.status),
      metAtEt: row.metAtEt,
      evidence: row.evidence,
      suggestedTrend: row.suggestedTrend,
      suggestedDirection: row.suggestedDirection,
    });
  }
  return sortRulesForDisplay(rows);
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

/** Keep tickers at or above quality threshold (0 = show all). Strict — no fallback. */
export function filterTickersByThreshold(
  tickers: PremarketTickerHit[],
  threshold: number,
): PremarketTickerHit[] {
  if (threshold <= 0) return tickers;
  return tickers.filter((t) => t.qualityPct >= threshold);
}

function sortTickersByQuality(tickers: PremarketTickerHit[]): PremarketTickerHit[] {
  return [...tickers].sort((a, b) => b.qualityPct - a.qualityPct);
}

/** True when at least one ticker meets `threshold` (false when threshold ≤ 0). */
export function anyTickerMeetsThreshold(
  strategies: PremarketStrategyGroup[],
  threshold: number,
): boolean {
  if (threshold <= 0) return false;
  return strategies.some((g) => g.tickers.some((t) => t.qualityPct >= threshold));
}

/**
 * Prefer tickers ≥ threshold when any qualify; otherwise keep best available
 * (highest qualityPct) so panes are not empty.
 */
export function filterStrategyGroupsByThreshold(
  strategies: PremarketStrategyGroup[],
  threshold: number,
): PremarketStrategyGroup[] {
  if (threshold <= 0) return strategies;
  const preferAbove = anyTickerMeetsThreshold(strategies, threshold);
  return strategies
    .map((group) => ({
      ...group,
      tickers: preferAbove
        ? filterTickersByThreshold(group.tickers, threshold)
        : sortTickersByQuality(group.tickers),
    }))
    .filter((group) => group.tickers.length > 0);
}

function strategyLabel(group: PremarketStrategyGroup): string {
  return group.shortName || group.name || group.strategyId;
}

function bestHitDedupeKey(symbol: string, direction: TradeDirection | null | undefined): string {
  return `${symbol.toUpperCase()}|${direction ?? "NONE"}`;
}

/**
 * Flatten strategy groups into top-N hits by preferred qualityPct.
 * Same symbol + direction across strategies merges into one row; each strategy keeps its %.
 * Non-isMovement strategies take priority over isMovement ones.
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
    movementProfile?: PremarketTickerHit["movementProfile"];
  };

  const byKey = new Map<string, Acc>();

  for (const group of strategies) {
    const label = strategyLabel(group);
    const isMovement = Boolean(group.isMovement);
    for (const ticker of group.tickers) {
      const key = bestHitDedupeKey(ticker.symbol, ticker.direction);
      const score: PremarketStrategyScore = {
        strategyId: group.strategyId,
        label,
        qualityPct: ticker.qualityPct,
        isMovement,
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
          movementProfile: ticker.movementProfile,
        });
        continue;
      }
      existing.strategies.push(score);
      if (!existing.name && ticker.name) existing.name = ticker.name;
      else if (ticker.name && !isMovement) existing.name = ticker.name;
      if (ticker.movementProfile && (!existing.movementProfile || !isMovement)) {
        existing.movementProfile = ticker.movementProfile;
      }
    }
  }

  return [...byKey.values()]
    .map((row) => {
      const ranked = [...row.strategies].sort(compareStrategyScores);
      const preferred = preferredQuality(ranked);
      const top = ranked[0];
      const topGroup =
        strategies.find((g) => g.strategyId === top?.strategyId) ?? row.bestGroup;
      const topTicker =
        topGroup.tickers.find(
          (t) =>
            t.symbol.toUpperCase() === row.symbol.toUpperCase() &&
            directionKey(t.direction) === directionKey(row.direction),
        ) ?? row.bestTicker;
      return {
        ...row,
        qualityPct: preferred,
        agreementCount: perfectAgreementCount(ranked),
        strategies: ranked,
        bestGroup: topGroup,
        bestTicker: {
          ...topTicker,
          qualityPct: preferred,
          movementProfile: row.movementProfile ?? topTicker.movementProfile,
        },
        movementProfile: row.movementProfile ?? topTicker.movementProfile,
      };
    })
    .sort(
      (a, b) =>
        movementTier(a.strategies) - movementTier(b.strategies) ||
        b.qualityPct - a.qualityPct ||
        (b.agreementCount ?? 0) - (a.agreementCount ?? 0) ||
        a.symbol.localeCompare(b.symbol) ||
        String(a.direction ?? "").localeCompare(String(b.direction ?? "")),
    )
    .slice(0, limit);
}

function compareStrategyScores(a: PremarketStrategyScore, b: PremarketStrategyScore): number {
  return (
    Number(Boolean(a.isMovement)) - Number(Boolean(b.isMovement)) ||
    b.qualityPct - a.qualityPct ||
    a.label.localeCompare(b.label)
  );
}

function preferredQuality(scores: PremarketStrategyScore[]): number {
  const nonMove = scores.filter((s) => !s.isMovement);
  const pool = nonMove.length ? nonMove : scores;
  return pool.reduce((max, s) => Math.max(max, s.qualityPct), 0);
}

function perfectAgreementCount(scores: PremarketStrategyScore[]): number {
  const nonMove = scores.filter((s) => !s.isMovement);
  const pool = nonMove.length ? nonMove : scores;
  return pool.filter((s) => s.qualityPct >= 100).length;
}

function movementTier(scores: PremarketStrategyScore[]): number {
  return scores.some((s) => !s.isMovement) ? 0 : 1;
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
  const ranked = [...row.strategies].sort(compareStrategyScores);
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
      isMovement: top?.isMovement,
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
    movementProfile:
      row.movementProfile ?? tickerFromGroup?.movementProfile ?? null,
  };

  return {
    symbol: row.symbol,
    name: row.name,
    direction: row.direction,
    qualityPct: row.qualityPct,
    agreementCount: row.agreementCount,
    strategies: ranked.length ? ranked : row.strategies,
    movementProfile: row.movementProfile ?? bestTicker.movementProfile ?? null,
    pick: row.pick ?? null,
    spot: row.spot ?? null,
    bestGroup: group,
    bestTicker,
  };
}

/**
 * Prefer API `bestResults` (BestResult feature); fall back to client aggregation
 * for older runs that lack the field. Prefer hits ≥ ``threshold``; if none qualify,
 * keep the top available by quality.
 */
export function resolvePremarketBestHits(
  strategies: PremarketStrategyGroup[],
  bestResults?: PremarketBestResultRow[] | null,
  limit = 10,
  threshold = 0,
): PremarketBestHit[] {
  const filteredStrategies = filterStrategyGroupsByThreshold(strategies, threshold);
  let hits: PremarketBestHit[];
  if (bestResults && bestResults.length > 0) {
    const above =
      threshold > 0
        ? bestResults.filter((row) => row.qualityPct >= threshold)
        : bestResults;
    const rows = (above.length > 0 ? above : bestResults).slice(0, limit);
    hits = rows.map((row) => attachBestHitRefs(row, filteredStrategies));
  } else {
    hits = buildPremarketBestResults(filteredStrategies, limit);
  }
  return hits;
}
