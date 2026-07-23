import type { CatalogTicker } from "../tickers/types";
import type { PreselectionResultResponse } from "./types";

function catalogActiveMap(catalog: CatalogTicker[]): Map<string, boolean> {
  return new Map(catalog.map((row) => [row.symbol.toUpperCase(), row.active]));
}

export function mergePreselectionWithCatalogActive(
  result: PreselectionResultResponse,
  catalog: CatalogTicker[] | null | undefined,
): PreselectionResultResponse {
  const activeMap = catalogActiveMap(Array.isArray(catalog) ? catalog : []);
  const strategies = Array.isArray(result?.strategies) ? result.strategies : [];

  return {
    ...result,
    strategies: strategies.map((group) => ({
      ...group,
      tickers: (Array.isArray(group?.tickers) ? group.tickers : []).map((row) => {
        const live = activeMap.get(row.symbol.toUpperCase());
        return live === undefined ? row : { ...row, currentlyActive: live };
      }),
    })),
  };
}
