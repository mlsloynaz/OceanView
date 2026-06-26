import type { MarketSnapshotFile, StrategiesCatalogFile } from "../types";

let catalogCache: StrategiesCatalogFile | null = null;
let snapshotCache: MarketSnapshotFile | null = null;

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function loadStrategiesCatalog(): Promise<StrategiesCatalogFile> {
  if (catalogCache) return catalogCache;
  catalogCache = await fetchJson<StrategiesCatalogFile>("/data/strategies.json");
  return catalogCache;
}

export async function loadMarketSnapshot(): Promise<MarketSnapshotFile> {
  if (snapshotCache) return snapshotCache;
  snapshotCache = await fetchJson<MarketSnapshotFile>("/data/market-snapshot.json");
  return snapshotCache;
}

export async function loadMarketWorkspaceData(): Promise<{
  catalog: StrategiesCatalogFile;
  snapshot: MarketSnapshotFile;
}> {
  const [catalog, snapshot] = await Promise.all([
    loadStrategiesCatalog(),
    loadMarketSnapshot(),
  ]);
  return { catalog, snapshot };
}

/** Mock-only — future API client will replace this module. */
export function marketDataUsesMock(): boolean {
  return true;
}
