export function formatRangoOptimoLabel(row: {
  rangoOptimoLow: number | null;
  rangoOptimoHigh: number | null;
  priceOptimo: number | null;
}): string {
  const fmtMoney = (n: number) =>
    Number.isInteger(n) ? String(n) : n.toFixed(2);

  if (row.rangoOptimoLow != null && row.rangoOptimoHigh != null) {
    return `$${fmtMoney(row.rangoOptimoLow)} – $${fmtMoney(row.rangoOptimoHigh)}`;
  }
  if (row.priceOptimo != null) return `$${fmtMoney(row.priceOptimo)}`;
  return "—";
}

export function formatMinMaxLabel(row: {
  minPrice: number | null;
  maxPrice: number | null;
}): string | null {
  if (row.minPrice == null && row.maxPrice == null) return null;
  const fmtMoney = (n: number | null | undefined) => {
    if (n == null || !Number.isFinite(n)) return "—";
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  };
  return `MIN $${fmtMoney(row.minPrice)} · MAX $${fmtMoney(row.maxPrice)}`;
}
