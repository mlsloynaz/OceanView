/**
 * Module-level Market workspace cache — survives MarketPage unmount on nav leave.
 */
import type {
  MarketEnvelope,
  MarketViewMode,
  RuleCardModel,
  StrategiesCatalogFile,
  StrategyCardModel,
  TickerCardModel,
} from "../types";
import { createAsyncCache } from "@/shared/lib/async-cache";

export type MarketModeSnapshot = {
  strategyCards?: StrategyCardModel[];
  tickerCards?: TickerCardModel[];
  ruleCards?: RuleCardModel[];
};

export type MarketWorkspaceCache = {
  envelope: MarketEnvelope | null;
  catalog: StrategiesCatalogFile | null;
  runId: string | null;
  snapshots: Partial<Record<MarketViewMode, MarketModeSnapshot>>;
};

const bootstrapCache = createAsyncCache<{
  envelope: MarketEnvelope;
  catalog: StrategiesCatalogFile;
}>({ ttlMs: 60_000 });

let workspace: MarketWorkspaceCache = {
  envelope: null,
  catalog: null,
  runId: null,
  snapshots: {},
};

export function peekMarketWorkspaceCache(): MarketWorkspaceCache {
  return {
    envelope: workspace.envelope,
    catalog: workspace.catalog,
    runId: workspace.runId,
    snapshots: { ...workspace.snapshots },
  };
}

export function setMarketBootstrapCache(
  envelope: MarketEnvelope,
  catalog: StrategiesCatalogFile,
): void {
  workspace.envelope = envelope;
  workspace.catalog = catalog;
  workspace.runId = envelope.runId;
  bootstrapCache.set({ envelope, catalog });
}

export function setMarketModeSnapshot(
  mode: MarketViewMode,
  snapshot: MarketModeSnapshot,
  runId?: string | null,
): void {
  workspace.snapshots = { ...workspace.snapshots, [mode]: snapshot };
  if (runId) workspace.runId = runId;
}

export function clearMarketModeSnapshots(): void {
  workspace.snapshots = {};
}

export function invalidateMarketBootstrapCache(): void {
  bootstrapCache.invalidate();
  workspace.envelope = null;
  workspace.catalog = null;
}

/** Clear snapshots after a new Assess run. */
export function invalidateMarketSnapshotsCache(): void {
  workspace.snapshots = {};
}

export async function getMarketBootstrapCached(
  loader: () => Promise<{ envelope: MarketEnvelope; catalog: StrategiesCatalogFile }>,
  opts?: { force?: boolean },
): Promise<{ envelope: MarketEnvelope; catalog: StrategiesCatalogFile }> {
  const data = await bootstrapCache.get(loader, opts);
  setMarketBootstrapCache(data.envelope, data.catalog);
  return data;
}
