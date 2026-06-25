export type RangoOptimoEntry = {
  symbol: string;
  nombre?: string | null;
  priceOptimo?: number | null;
  rangoOptimoLow?: number | null;
  rangoOptimoHigh?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
};

export type RangoOptimoFile = {
  analysisDate?: string | null;
  entries: RangoOptimoEntry[];
};

export type RangoOptimoLookupResult = {
  success: boolean;
  error?: string;
  symbol?: string;
  priceOptimo?: number | null;
  rangoOptimoLow?: number | null;
  rangoOptimoHigh?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  rangeLow?: number | null;
  rangeHigh?: number | null;
};
