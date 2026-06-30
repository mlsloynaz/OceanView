export const TICKERS_PAGE_SIZE = 10;

export function sortTickersAlphabetically<T extends { symbol: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function paginate<T>(rows: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export function totalPages(count: number, pageSize: number): number {
  return Math.max(1, Math.ceil(count / pageSize));
}
