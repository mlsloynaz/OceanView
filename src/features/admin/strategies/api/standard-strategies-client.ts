import type { StrategiesCatalogFile, StrategyCatalogItem } from "@/features/market/types";
import {
  fetchStrategiesCatalog,
  patchMarketStrategyActive as patchMarketStrategyActiveApi,
} from "@/features/market/api/market-client";

const MOCK_DELAY_MS = 200;

const USE_MOCK = import.meta.env.VITE_USE_MOCK_MARKET === "true";

let mockCatalog: StrategyCatalogItem[] = [
  {
    id: "estrategia-01",
    name: "Hourly Trend Change",
    shortName: "Trend Change 1H",
    description: "Hourly trendline break with Bollinger midpoint rupture on 1h.",
    active: true,
    rules: [],
  },
  {
    id: "estrategia-02",
    name: "Midpoint Bounce",
    shortName: "Midpoint Bounce",
    description: "Daily MA20 bounce with hourly level respect.",
    active: false,
    rules: [],
  },
  {
    id: "estrategia-05",
    name: "Inside Bollinger 15M",
    shortName: "Inside BB 15M",
    description: "Fast 15m opening move inside Bollinger bands.",
    active: true,
    rules: [],
  },
];

function delay(ms = MOCK_DELAY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeStrategy(row: StrategyCatalogItem): StrategyCatalogItem {
  return {
    ...row,
    active: row.active !== false,
    rules: row.rules ?? [],
  };
}

export function standardStrategiesUseMock(): boolean {
  return USE_MOCK;
}

export async function fetchStandardStrategiesCatalog(): Promise<StrategiesCatalogFile> {
  if (USE_MOCK) {
    await delay();
    return {
      version: "1",
      updatedAt: "mock",
      strategies: mockCatalog.map((row) => normalizeStrategy({ ...row })),
    };
  }
  const payload = await fetchStrategiesCatalog();
  return {
    ...payload,
    strategies: (payload.strategies ?? []).map(normalizeStrategy),
  };
}

export async function patchStandardStrategyActive(
  strategyId: string,
  active: boolean,
): Promise<StrategyCatalogItem> {
  const id = strategyId.trim();
  if (!id) {
    throw new Error("Strategy id is required.");
  }
  if (USE_MOCK) {
    await delay();
    const index = mockCatalog.findIndex((row) => row.id === id);
    if (index < 0) {
      throw new Error(`Unknown strategy: ${id}`);
    }
    mockCatalog[index] = { ...mockCatalog[index], active };
    return normalizeStrategy({ ...mockCatalog[index] });
  }
  const updated = await patchMarketStrategyActiveApi(id, active);
  return normalizeStrategy(updated);
}
