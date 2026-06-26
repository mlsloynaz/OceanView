import type { MarketViewMode } from "../types";

export const MARKET_MODE_STORAGE_KEY = "oceanview.market.viewMode";

export const MARKET_MODES: MarketViewMode[] = ["strategies", "tickers", "rules"];

export function isMarketViewMode(value: string | undefined): value is MarketViewMode {
  return MARKET_MODES.includes(value as MarketViewMode);
}

export function marketPath(mode: MarketViewMode): string {
  return `/market/${mode}`;
}

export function readStoredMarketMode(): MarketViewMode | null {
  try {
    const raw = localStorage.getItem(MARKET_MODE_STORAGE_KEY);
    return isMarketViewMode(raw ?? undefined) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredMarketMode(mode: MarketViewMode): void {
  try {
    localStorage.setItem(MARKET_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore quota / private mode
  }
}

export function defaultMarketMode(): MarketViewMode {
  return readStoredMarketMode() ?? "strategies";
}
