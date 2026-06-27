import type { MarketEnvelope, MarketSnapshotFile, StrategiesCatalogFile } from "../types";
import {
  fetchMarketEnvelope,
  fetchRulesSnapshot,
  fetchStrategiesCatalog,
  fetchStrategiesSnapshot,
  fetchTickersSnapshot,
} from "./market-client";
import {
  adaptRuleSnapshotItems,
  adaptStrategySnapshotItems,
  adaptTickerSnapshotItems,
} from "./adapters";
import type { MarketViewMode } from "../types";
import type { RuleCardModel, StrategyCardModel, TickerCardModel } from "../types";

let catalogCache: StrategiesCatalogFile | null = null;
let snapshotCache: MarketSnapshotFile | null = null;

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function loadStrategiesCatalogMock(): Promise<StrategiesCatalogFile> {
  if (catalogCache) return catalogCache;
  catalogCache = await fetchJson<StrategiesCatalogFile>("/data/strategies.json");
  return catalogCache;
}

export async function loadMarketSnapshotMock(): Promise<MarketSnapshotFile> {
  if (snapshotCache) return snapshotCache;
  snapshotCache = await fetchJson<MarketSnapshotFile>("/data/market-snapshot.json");
  return snapshotCache;
}

export async function loadMarketWorkspaceDataMock(): Promise<{
  catalog: StrategiesCatalogFile;
  snapshot: MarketSnapshotFile;
}> {
  const [catalog, snapshot] = await Promise.all([
    loadStrategiesCatalogMock(),
    loadMarketSnapshotMock(),
  ]);
  return { catalog, snapshot };
}

export async function loadMarketBootstrap(): Promise<{
  envelope: MarketEnvelope;
  catalog: StrategiesCatalogFile;
}> {
  const [envelope, catalog] = await Promise.all([
    fetchMarketEnvelope(),
    fetchStrategiesCatalog(),
  ]);
  return { envelope, catalog };
}

export async function loadSnapshotForModeWithCatalog(
  mode: MarketViewMode,
  runId: string,
  catalog: StrategiesCatalogFile,
): Promise<{
  runId: string;
  strategyCards?: StrategyCardModel[];
  tickerCards?: TickerCardModel[];
  ruleCards?: RuleCardModel[];
}> {
  switch (mode) {
    case "strategies": {
      const payload = await fetchStrategiesSnapshot(runId);
      return {
        runId: payload.runId,
        strategyCards: adaptStrategySnapshotItems(catalog.strategies, payload.items),
      };
    }
    case "tickers": {
      const payload = await fetchTickersSnapshot(runId);
      return {
        runId: payload.runId,
        tickerCards: adaptTickerSnapshotItems(payload.items),
      };
    }
    case "rules": {
      const payload = await fetchRulesSnapshot(runId);
      return {
        runId: payload.runId,
        ruleCards: adaptRuleSnapshotItems(payload.items),
      };
    }
  }
}

export { marketDataUsesMock } from "./market-client";
