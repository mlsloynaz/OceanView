import type { PreselectionResultResponse, PreselectionTickerRow } from "./types";

export function matchesSemiFinalSearch(
  row: Pick<PreselectionTickerRow, "symbol" | "name">,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    row.symbol.toLowerCase().includes(q) ||
    (row.name?.toLowerCase().includes(q) ?? false)
  );
}

export function rankSemiFinalSearch(
  row: Pick<PreselectionTickerRow, "symbol" | "name">,
  query: string,
): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const sym = row.symbol.toLowerCase();
  if (sym === q) return 0;
  if (sym.startsWith(q)) return 1;
  return 2;
}

export function filterSemiFinalResult(
  result: PreselectionResultResponse | null,
  query: string,
): PreselectionResultResponse | null {
  if (!result) return null;
  const q = query.trim();
  const strategies = Array.isArray(result.strategies) ? result.strategies : [];
  const withBiasOnly = strategies
    .map((group) => {
      const tickers = (Array.isArray(group.tickers) ? group.tickers : []).filter(
        (row) => row.directionBias === "CALL" || row.directionBias === "PUT",
      );
      return { ...group, tickers, tickerCount: tickers.length };
    })
    .filter((group) => group.tickers.length > 0);

  if (!q) return { ...result, strategies: withBiasOnly };

  const filtered = strategies
    .map((group) => {
      const tickers = (Array.isArray(group.tickers) ? group.tickers : [])
        .filter((row) => row.directionBias === "CALL" || row.directionBias === "PUT")
        .filter((row) => matchesSemiFinalSearch(row, q))
        .sort(
          (a, b) =>
            rankSemiFinalSearch(a, q) - rankSemiFinalSearch(b, q) ||
            a.symbol.localeCompare(b.symbol),
        );
      return {
        ...group,
        tickers,
        tickerCount: tickers.length,
      };
    })
    .filter((group) => group.tickers.length > 0);

  return { ...result, strategies: filtered };
}

export function semiFinalSearchSuggestions(
  result: PreselectionResultResponse | null,
  query: string,
  limit = 8,
): PreselectionTickerRow[] {
  if (!result || !query.trim()) return [];
  const seen = new Set<string>();
  const matches: PreselectionTickerRow[] = [];

  for (const group of result.strategies ?? []) {
    for (const row of group.tickers ?? []) {
      if (row.directionBias !== "CALL" && row.directionBias !== "PUT") continue;
      const upper = row.symbol.toUpperCase();
      if (seen.has(upper) || !matchesSemiFinalSearch(row, query)) continue;
      seen.add(upper);
      matches.push(row);
    }
  }

  return matches
    .sort(
      (a, b) =>
        rankSemiFinalSearch(a, query) - rankSemiFinalSearch(b, query) ||
        a.symbol.localeCompare(b.symbol),
    )
    .slice(0, limit);
}

export function semiFinalMatchCount(result: PreselectionResultResponse | null, query: string): number {
  if (!result || !query.trim()) return 0;
  const seen = new Set<string>();
  let count = 0;
  for (const group of result.strategies ?? []) {
    for (const row of group.tickers ?? []) {
      if (row.directionBias !== "CALL" && row.directionBias !== "PUT") continue;
      const upper = row.symbol.toUpperCase();
      if (seen.has(upper) || !matchesSemiFinalSearch(row, query)) continue;
      seen.add(upper);
      count += 1;
    }
  }
  return count;
}
