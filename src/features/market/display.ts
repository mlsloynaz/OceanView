import type {
  MarketSnapshotFile,
  RuleCardModel,
  RuleDisplayRow,
  RuleEval,
  RuleStatus,
  StrategyCardModel,
  StrategyCatalogItem,
  StrategyRule,
  TickerCardModel,
  TickerEvalResult,
  TickerStrategyEval,
  TradeDirection,
} from "./types";
import { evalDedupeKey } from "@/shared/lib/rule-dedupe";
import { activeCatalogStrategies } from "./lib/catalog";
import { cn } from "@/shared/lib/cn";

export { formatEntryWindow } from "./lib/entry-window";

export function isSignal(qualityPct: number, threshold: number): boolean {
  return qualityPct >= threshold;
}

export function qualityBadgeClass(pct: number, threshold: number): string {
  if (pct >= threshold) {
    return "bg-ocean-teal/15 text-ocean-teal-dim dark:text-ocean-teal";
  }
  if (pct >= threshold * 0.6) {
    return "bg-amber-500/15 text-amber-800 dark:text-amber-200";
  }
  return "bg-ocean-mid/30 text-ocean-sand";
}

export function directionBadgeClass(direction: TradeDirection | null): string {
  if (direction === "CALL") {
    return "bg-ocean-teal/20 text-ocean-teal-dim dark:text-ocean-teal";
  }
  if (direction === "PUT") {
    return "bg-ocean-danger-muted text-ocean-danger";
  }
  return "bg-ocean-mid/30 text-ocean-sand";
}

export function ruleStatusTitle(status: RuleStatus): string {
  switch (status) {
    case "met":
      return "Met";
    case "partial":
      return "Partial / near";
    case "not_met":
      return "Not met";
    case "about_to_cross":
      return "About to cross BB mid";
    default:
      return "Pending";
  }
}

/** Normalize catalog/eval rule role for display ordering and icons. */
export function normalizeDisplayRuleType(
  type: string | null | undefined,
): "gate" | "required" | "extra" {
  const t = String(type ?? "required")
    .trim()
    .toLowerCase();
  if (t === "gate") return "gate";
  if (t === "extra" || t === "bonus" || t === "optional") return "extra";
  return "required";
}

export function isBonusRuleType(type: string | null | undefined): boolean {
  return normalizeDisplayRuleType(type) === "extra";
}

/** Required (and gate) first, then bonus/extra — stable within each group. */
export function sortRulesForDisplay<T extends { type?: string | null }>(rules: T[]): T[] {
  const rank = (type: string | null | undefined) => {
    const t = normalizeDisplayRuleType(type);
    if (t === "gate") return 0;
    if (t === "extra") return 2;
    return 1;
  };
  return [...rules].sort((a, b) => rank(a.type) - rank(b.type));
}

export function ruleStatusClass(status: RuleStatus): string {
  return cn(
    status === "met" && "text-ocean-teal-dim dark:text-ocean-teal",
    status === "partial" && "text-amber-600 dark:text-amber-400",
    status === "not_met" && "text-orange-600 dark:text-orange-400",
    status === "about_to_cross" && "text-sky-600 dark:text-sky-400",
    status === "pending" && "text-ocean-sand",
  );
}

/** Map API / legacy statuses to UI rule icons. */
export function normalizeRuleStatus(status: string | undefined | null): RuleStatus {
  const value = (status ?? "pending").toLowerCase();
  if (
    value === "met" ||
    value === "partial" ||
    value === "not_met" ||
    value === "pending" ||
    value === "about_to_cross"
  ) {
    return value;
  }
  if (value === "unknown" || value === "failed" || value === "skipped") {
    return "not_met";
  }
  return "pending";
}

export function buildStrategyCards(
  catalog: StrategyCatalogItem[],
  snapshot: MarketSnapshotFile,
): StrategyCardModel[] {
  const threshold = snapshot.signalThresholdPct;
  return activeCatalogStrategies(catalog).map((strategy) => {
    const matches: { symbol: string; qualityPct: number }[] = [];
    for (const ticker of snapshot.results) {
      const evalRow = ticker.strategies.find((s) => s.strategyId === strategy.id);
      if (evalRow && isSignal(evalRow.qualityPct, threshold)) {
        matches.push({ symbol: ticker.symbol, qualityPct: evalRow.qualityPct });
      }
    }
    matches.sort((a, b) => b.qualityPct - a.qualityPct);
    return {
      strategy,
      signalCount: matches.length,
      previewTickers: matches.slice(0, 4),
    };
  });
}

export function buildTickerCards(
  catalog: StrategyCatalogItem[],
  snapshot: MarketSnapshotFile,
): TickerCardModel[] {
  const threshold = snapshot.signalThresholdPct;
  const activeCatalog = activeCatalogStrategies(catalog);
  const catalogById = new Map(activeCatalog.map((s) => [s.id, s]));
  const activeIds = new Set(activeCatalog.map((s) => s.id));

  return snapshot.results.map((ticker) => {
    const activeEvals = ticker.strategies.filter((s) => activeIds.has(s.strategyId));
    const signals = activeEvals
      .filter((s) => isSignal(s.qualityPct, threshold))
      .sort((a, b) => b.qualityPct - a.qualityPct);

    const best = signals[0] ?? null;
    const top = [...activeEvals].sort((a, b) => b.qualityPct - a.qualityPct)[0] ?? null;

    return {
      symbol: ticker.symbol,
      name: ticker.name,
      signalCount: signals.length,
      bestSignal: best
        ? {
            strategyId: best.strategyId,
            strategyName: catalogById.get(best.strategyId)?.name ?? best.strategyId,
            qualityPct: best.qualityPct,
            direction: best.direction ?? null,
          } satisfies TickerCardModel["bestSignal"] & object
        : null,
      topStrategyEval: top,
      movementProfile: ticker.movementProfile ?? null,
    };
  });
}

export function buildRuleCards(
  catalog: StrategyCatalogItem[],
  snapshot: MarketSnapshotFile,
): RuleCardModel[] {
  const cards: RuleCardModel[] = [];

  for (const strategy of activeCatalogStrategies(catalog)) {
    for (const rule of strategy.rules) {
      const preview: RuleCardModel["previewSymbols"] = [];
      let metCount = 0;

      for (const ticker of snapshot.results) {
        const evalRow = ticker.strategies.find((s) => s.strategyId === strategy.id);
        const ruleEval = evalRow?.rules.find((r) => r.ruleKey === rule.ruleKey);
        if (!ruleEval) continue;
        if (ruleEval.status === "met") metCount += 1;
        preview.push({
          symbol: ticker.symbol,
          status: ruleEval.status,
          metAtEt: ruleEval.metAtEt,
        });
      }

      preview.sort((a, b) => {
        if (a.status === "met" && b.status !== "met") return -1;
        if (a.status !== "met" && b.status === "met") return 1;
        return a.symbol.localeCompare(b.symbol);
      });

      cards.push({
        ruleKey: rule.ruleKey,
        label: rule.label,
        type: rule.type,
        timeframe: rule.timeframe,
        strategyId: strategy.id,
        strategyName: strategy.name,
        metCount,
        totalSymbols: snapshot.results.length,
        previewSymbols: preview.slice(0, 4),
      });
    }
  }

  return cards.sort((a, b) => {
    if (a.metCount !== b.metCount) return b.metCount - a.metCount;
    return a.label.localeCompare(b.label);
  });
}

export function tickersForStrategy(
  strategyId: string,
  snapshot: MarketSnapshotFile,
  threshold: number,
): Array<TickerEvalResult & { eval: TickerStrategyEval }> {
  const rows: Array<TickerEvalResult & { eval: TickerStrategyEval }> = [];
  for (const ticker of snapshot.results) {
    const evalRow = ticker.strategies.find((s) => s.strategyId === strategyId);
    if (evalRow) {
      rows.push({ ...ticker, eval: evalRow });
    }
  }
  return rows.sort((a, b) => {
    const aSignal = isSignal(a.eval.qualityPct, threshold);
    const bSignal = isSignal(b.eval.qualityPct, threshold);
    if (aSignal !== bSignal) return aSignal ? -1 : 1;
    return b.eval.qualityPct - a.eval.qualityPct;
  });
}

export function mergeRuleDisplay(
  catalogRules: StrategyRule[],
  evalRules: RuleEval[],
): RuleDisplayRow[] {
  const evalByKey = new Map(evalRules.map((r) => [r.ruleKey, r]));
  const seen = new Set<string>();
  const rows: RuleDisplayRow[] = [];
  for (const rule of catalogRules) {
    const dedupeKey = evalDedupeKey({
      ruleKey: rule.ruleKey,
      trend: rule.trend,
      operation: rule.operation,
    });
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const ev = evalByKey.get(rule.ruleKey);
    rows.push({
      ruleKey: rule.ruleKey,
      label: rule.label,
      type: normalizeDisplayRuleType(rule.type) === "extra" ? "extra" : "required",
      status: normalizeRuleStatus(ev?.status),
      metAtEt: ev?.metAtEt,
      evidence: ev?.evidence,
      suggestedTrend: ev?.suggestedTrend,
      suggestedDirection: ev?.suggestedDirection,
    });
  }
  return sortRulesForDisplay(rows);
}

export function formatEvaluatedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function signalCountLabel(count: number): string {
  if (count === 1) return "1 signal today";
  return `${count} signals today`;
}

/** Latest ET time the strategy met the signal threshold (explicit or from required rules). */
export function strategyAchievedAtEt(
  evalRow: TickerStrategyEval,
  catalogRules: StrategyRule[],
): string | null {
  const explicit = evalRow.achievedAtEt?.trim();
  if (explicit) return formatAchievedTimeEt(explicit);

  const requiredKeys = new Set(
    catalogRules.filter((r) => r.type === "required").map((r) => r.ruleKey),
  );
  let latest: string | null = null;
  for (const rule of evalRow.rules) {
    if (rule.status !== "met" || !requiredKeys.has(rule.ruleKey)) continue;
    const at = rule.metAtEt?.trim();
    if (!at) continue;
    if (!latest || at > latest) latest = at;
  }
  return latest ? formatAchievedTimeEt(latest) : null;
}

export function formatAchievedTimeEt(raw: string): string {
  const trimmed = raw.trim();
  if (/ET/i.test(trimmed)) return trimmed;
  return `${trimmed} ET`;
}

/** Clock time only (ET) for rule pass display — no date, no "ET" suffix. */
export function formatRulePassedTimeOnly(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  const clock = trimmed.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
  if (clock && !trimmed.includes("T")) {
    return clock[1].replace(/\s+/g, " ").trim();
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(parsed);
  }
  return null;
}

export function extractTimeFromEvidence(evidence: string | null | undefined): string | null {
  if (!evidence) return null;
  const isoAt = evidence.match(/@\s*(\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}(?::\d{2})?)/i);
  if (isoAt) {
    return formatRulePassedTimeOnly(isoAt[1].replace(" ", "T"));
  }
  const clockAt = evidence.match(/@\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
  return clockAt ? clockAt[1].trim() : null;
}

export function resolveRulePassedTime(metAtEt?: string | null, evidence?: string | null): string | null {
  return formatRulePassedTimeOnly(metAtEt) ?? extractTimeFromEvidence(evidence);
}

/** Compact measured vs threshold line for rule detail rows. */
export function formatRuleThresholdSummary(evidence: string | null | undefined): string | null {
  if (!evidence?.trim()) return null;
  const parts: string[] = [];
  const indexVal = evidence.match(/\bindex ([\d.]+)/i);
  const atrVal = evidence.match(/ATR ratio ([\d.]+)/i);
  const needClause = evidence.match(/\(need ([^)]+)\)/i);
  const slopePct = evidence.match(/([+-][\d.]+)% en \d+ velas/i);
  const openInside = evidence.match(/Open ([\d.]+) (inside|outside) BB/i);
  const bbWidth = evidence.match(/BB width ([\d.]+)%/i);

  if (bbWidth) parts.push(`BB width ${bbWidth[1]}%`);
  if (indexVal) parts.push(`index ${indexVal[1]}`);
  if (atrVal) parts.push(`ATR ${atrVal[1]}`);
  if (openInside) parts.push(`open ${openInside[1]} ${openInside[2]}`);
  if (slopePct) parts.push(`slope ${slopePct[1]}%`);
  if (needClause) parts.push(`need ${needClause[1]}`);

  if (parts.length > 0) return parts.join(" · ");

  // No structured metrics — avoid echoing truncated evidence (duplicates the detail line).
  return null;
}
