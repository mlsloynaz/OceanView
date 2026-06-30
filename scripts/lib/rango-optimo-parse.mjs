/** Shared Excel → JSON parsing for rango óptimo (used by import script). */

export function parseDollarRange(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return { low: null, high: null };
  const nums = raw.match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 2) return { low: null, high: null };
  return { low: Number(nums[0]), high: Number(nums[1]) };
}

export function parseMinMax(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return { min: null, max: null };
  const minMatch = raw.match(/MIN\s*\$?\s*(\d+(?:\.\d+)?)/i);
  const maxMatch = raw.match(/MAX\s*\$?\s*(\d+(?:\.\d+)?)/i);
  return {
    min: minMatch ? Number(minMatch[1]) : null,
    max: maxMatch ? Number(maxMatch[1]) : null,
  };
}

export function midpoint(low, high) {
  if (low == null || high == null) return null;
  return Math.round(((low + high) / 2) * 100) / 100;
}

export function parseDateFromFilename(filename) {
  const match = String(filename).match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function normalizeHeader(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

export function pickColumn(row, ...labels) {
  for (const label of labels) {
    const wanted = normalizeHeader(label);
    const hit = Object.entries(row).find(([key]) => normalizeHeader(key) === wanted);
    if (hit) return hit[1];
  }
  return undefined;
}

export function cleanCompanyName(symbol, rawName) {
  let name = String(rawName ?? "").trim();
  if (!name) return null;
  const sym = String(symbol ?? "").trim();
  if (sym) {
    const prefix = new RegExp(`^${sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*-\\s*`, "i");
    name = name.replace(prefix, "");
  }
  name = name.replace(/\s+Stock Price and Quote\s*$/i, "").trim();
  return name.slice(0, 128) || null;
}

/** Excel serial date → YYYY-MM-DD (UTC). */
export function excelSerialToIsoDate(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n) || n < 1) return null;
  const utc = Date.UTC(1899, 11, 30) + Math.round(n) * 86_400_000;
  return new Date(utc).toISOString().slice(0, 10);
}

export function parseWorkbookRows(rawRows, filename) {
  const entries = [];
  let analysisDate = parseDateFromFilename(filename);

  for (const raw of rawRows) {
    const symbol = String(pickColumn(raw, "TICKER") ?? "")
      .trim()
      .toUpperCase();
    if (!symbol) continue;

    const rango = parseDollarRange(pickColumn(raw, "RANGO ÓPTIMO", "RANGO OPTIMO"));
    const minMax = parseMinMax(pickColumn(raw, "MÍNIMO Y MÁXIMO", "MINIMO Y MAXIMO"));
    const nombre = cleanCompanyName(
      symbol,
      pickColumn(raw, "NOMBRE", "NAME", "Nombre"),
    );

    if (!analysisDate) {
      const rowDate = pickColumn(
        raw,
        "FECHA DE ANÁLISIS",
        "FECHA DE ANALISIS",
        "FECHA ANALISIS",
      );
      analysisDate = excelSerialToIsoDate(rowDate) ?? analysisDate;
    }

    if (rango.low == null || rango.high == null) {
      console.warn(`Skipping ${symbol}: could not parse RANGO ÓPTIMO`);
      continue;
    }

    const entry = {
      symbol,
      ...(nombre ? { nombre } : {}),
      priceOptimo: midpoint(rango.low, rango.high),
      rangoOptimoLow: rango.low,
      rangoOptimoHigh: rango.high,
      ...(minMax.min != null ? { minPrice: minMax.min } : {}),
      ...(minMax.max != null ? { maxPrice: minMax.max } : {}),
    };

    entries.push(entry);
  }

  entries.sort((a, b) => a.symbol.localeCompare(b.symbol));

  return {
    entries,
    analysisDate: analysisDate ?? new Date().toISOString().slice(0, 10),
  };
}
