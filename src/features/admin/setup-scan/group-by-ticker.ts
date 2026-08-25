import type {
  PreselectionResultResponse,
  PreselectionStrategyGroup,
  PreselectionStrategySuggestion,
  PreselectionTickerGroup,
  PreselectionTickerRow,
} from "./types";
import { isSemiFinalDisplayableTicker, matchesSemiFinalSearch, rankSemiFinalSearch } from "./search";

export function hasSelectedBias(bias: string | null | undefined): bias is "CALL" | "PUT" {
  return bias === "CALL" || bias === "PUT";
}

function rowToSuggestion(
  group: PreselectionStrategyGroup,
  ticker: PreselectionTickerRow,
): PreselectionStrategySuggestion {
  return {
    strategyId: group.strategyId,
    strategyName: group.name,
    shortName: group.shortName,
    profileId: group.profileId,
    score: ticker.score,
    maxScore: ticker.maxScore,
    tier: ticker.tier,
    reasons: ticker.reasons ?? [],
    avoidReasons: ticker.avoidReasons ?? [],
    breakdown: ticker.breakdown ?? [],
    candidateRules: ticker.candidateRules ?? [],
    requiredPassed: ticker.requiredPassed,
    hintNudge: ticker.hintNudge,
    strategyHints: ticker.strategyHints ?? [],
    flags: ticker.flags ?? [],
    summaryLines: ticker.summaryLines ?? [],
  };
}

/** Group strategy rows into one entry per ticker (CALL/PUT or undirected EOD watch). */
export function buildSemiFinalTickerGroups(
  result: PreselectionResultResponse | null,
): PreselectionTickerGroup[] {
  if (!result) return [];

  const bySymbol = new Map<string, PreselectionTickerGroup>();

  for (const group of result.strategies ?? []) {
    for (const ticker of group.tickers ?? []) {
      if (!isSemiFinalDisplayableTicker(ticker)) continue;

      const symbol = ticker.symbol.toUpperCase();
      const existing = bySymbol.get(symbol);
      const suggestion = rowToSuggestion(group, ticker);
      const bias = hasSelectedBias(ticker.directionBias) ? ticker.directionBias : null;

      if (existing) {
        existing.suggestions.push(suggestion);
        existing.suggestions.sort(
          (a, b) => b.score - a.score || a.strategyName.localeCompare(b.strategyName),
        );
        // Prefer a resolved CALL/PUT if a later strategy supplies one.
        if (existing.directionBias == null && bias != null) {
          existing.directionBias = bias;
        }
        continue;
      }

      bySymbol.set(symbol, {
        symbol,
        name: ticker.name,
        directionBias: bias,
        currentlyActive: ticker.currentlyActive,
        suggestions: [suggestion],
      });
    }
  }

  return [...bySymbol.values()].sort((a, b) => {
    const bestA = a.suggestions[0]?.score ?? 0;
    const bestB = b.suggestions[0]?.score ?? 0;
    return bestB - bestA || a.symbol.localeCompare(b.symbol);
  });
}

export function filterSemiFinalTickerGroups(
  groups: PreselectionTickerGroup[],
  query: string,
): PreselectionTickerGroup[] {
  const q = query.trim();
  if (!q) return groups;

  return groups
    .filter((group) => matchesSemiFinalSearch(group, q))
    .sort(
      (a, b) =>
        rankSemiFinalSearch(a, q) - rankSemiFinalSearch(b, q) ||
        a.symbol.localeCompare(b.symbol),
    );
}

export function semiFinalTickerSearchSuggestions(
  groups: PreselectionTickerGroup[],
  query: string,
  limit = 8,
): PreselectionTickerGroup[] {
  if (!query.trim()) return [];
  return filterSemiFinalTickerGroups(groups, query).slice(0, limit);
}

export function semiFinalTickerMatchCount(groups: PreselectionTickerGroup[], query: string): number {
  if (!query.trim()) return 0;
  return filterSemiFinalTickerGroups(groups, query).length;
}
