import type { CatalogTicker } from "./types";

export function matchesTickerSearch(row: CatalogTicker, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    row.symbol.toLowerCase().includes(q) ||
    (row.name?.toLowerCase().includes(q) ?? false)
  );
}

export function rankTickerSearch(row: CatalogTicker, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const sym = row.symbol.toLowerCase();
  if (sym === q) return 0;
  if (sym.startsWith(q)) return 1;
  return 2;
}

export function filterTickersBySearch(rows: CatalogTicker[], query: string): CatalogTicker[] {
  const q = query.trim();
  if (!q) return rows;
  return rows
    .filter((row) => matchesTickerSearch(row, q))
    .sort(
      (a, b) =>
        rankTickerSearch(a, q) - rankTickerSearch(b, q) ||
        a.symbol.localeCompare(b.symbol),
    );
}
