function fmt(n: number | null | undefined): string {
  return n != null && Number.isFinite(n) ? n.toFixed(2) : "—";
}

export function formatRangoOptimoLabel(row: {
  rangoOptimoLow: number | null;
  rangoOptimoHigh: number | null;
  priceOptimo: number | null;
}): string {
  if (row.rangoOptimoLow != null && row.rangoOptimoHigh != null) {
    return `$${fmt(row.rangoOptimoLow)} – $${fmt(row.rangoOptimoHigh)}`;
  }
  if (row.priceOptimo != null) return `$${fmt(row.priceOptimo)}`;
  return "—";
}

export function formatMinMaxLabel(row: {
  minPrice: number | null;
  maxPrice: number | null;
}): string | null {
  if (row.minPrice == null && row.maxPrice == null) return null;
  return `MIN $${fmt(row.minPrice)} · MAX $${fmt(row.maxPrice)}`;
}
