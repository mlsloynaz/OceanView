import type { CatalogTicker } from "../tickers/types";
import type { PreselectionResultResponse } from "./types";

function catalogActiveMap(catalog: CatalogTicker[]): Map<string, boolean> {
  return new Map(catalog.map((row) => [row.symbol.toUpperCase(), row.active]));
}

export function mergePreselectionWithCatalogActive(
  result: PreselectionResultResponse,
  catalog: CatalogTicker[],
): PreselectionResultResponse {
  const activeMap = catalogActiveMap(catalog);

  return {
    ...result,
    strategies: result.strategies.map((group) => ({
      ...group,
      tickers: group.tickers.map((row) => {
        const live = activeMap.get(row.symbol.toUpperCase());
        return live === undefined ? row : { ...row, currentlyActive: live };
      }),
    })),
  };
}
