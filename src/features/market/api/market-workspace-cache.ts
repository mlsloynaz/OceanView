/**
 * Module-level Market workspace cache — survives MarketPage unmount on nav leave.
 *
 * Envelope/catalog/snapshots/details stay until explicitly invalidated (new Assess).
 * Not React Query — shared pattern with Premarket (`createAsyncCache` + peek/set).
 */
import type {
  MarketEnvelope,
  MarketSnapshotMode,
  RuleCardModel,
  StrategiesCatalogFile,
  StrategyCardModel,
  StrategyDetailResponse,
  TickerCardModel,
  TickerDetailResponse,
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
  snapshots: Partial<Record<MarketSnapshotMode, MarketModeSnapshot>>;
};

const bootstrapCache = createAsyncCache<{
  envelope: MarketEnvelope;
  catalog: StrategiesCatalogFile;
}>({ ttlMs: Number.POSITIVE_INFINITY });

let workspace: MarketWorkspaceCache = {
  envelope: null,
  catalog: null,
  runId: null,
  snapshots: {},
};

/** Per-run mode snapshots — avoid refetch when switching Strategies/Tickers/Rules. */
const modeSnapshotLoaders = {
  strategies: createAsyncCache<MarketModeSnapshot & { runId: string }>({
    ttlMs: Number.POSITIVE_INFINITY,
  }),
  tickers: createAsyncCache<MarketModeSnapshot & { runId: string }>({
    ttlMs: Number.POSITIVE_INFINITY,
  }),
  rules: createAsyncCache<MarketModeSnapshot & { runId: string }>({
    ttlMs: Number.POSITIVE_INFINITY,
  }),
} as const;

const strategyDetailByKey = new Map<
  string,
  { value: StrategyDetailResponse; fetchedAt: number }
>();
const tickerDetailByKey = new Map<
  string,
  { value: TickerDetailResponse; fetchedAt: number }
>();
const strategyDetailInflight = new Map<string, Promise<StrategyDetailResponse>>();
const tickerDetailInflight = new Map<string, Promise<TickerDetailResponse>>();

function detailKey(runId: string, id: string): string {
  return `${runId.trim()}::${id.trim().toUpperCase()}`;
}

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
  mode: MarketSnapshotMode,
  snapshot: MarketModeSnapshot,
  runId?: string | null,
): void {
  workspace.snapshots = { ...workspace.snapshots, [mode]: snapshot };
  if (runId) {
    workspace.runId = runId;
    modeSnapshotLoaders[mode].set({ ...snapshot, runId });
  }
}

export function clearMarketModeSnapshots(): void {
  workspace.snapshots = {};
  for (const cache of Object.values(modeSnapshotLoaders)) {
    cache.invalidate();
  }
}

export function invalidateMarketBootstrapCache(): void {
  bootstrapCache.invalidate();
  workspace.envelope = null;
  workspace.catalog = null;
}

/** Clear result projections + detail panes after a new Assess run. */
export function invalidateMarketSnapshotsCache(): void {
  workspace.snapshots = {};
  for (const cache of Object.values(modeSnapshotLoaders)) {
    cache.invalidate();
  }
  strategyDetailByKey.clear();
  tickerDetailByKey.clear();
  strategyDetailInflight.clear();
  tickerDetailInflight.clear();
}

/** Invalidate all Market result caches (bootstrap envelope + snapshots + details). */
export function invalidateMarketResultCaches(): void {
  invalidateMarketSnapshotsCache();
}

export async function getMarketBootstrapCached(
  loader: () => Promise<{ envelope: MarketEnvelope; catalog: StrategiesCatalogFile }>,
  opts?: { force?: boolean },
): Promise<{ envelope: MarketEnvelope; catalog: StrategiesCatalogFile }> {
  const data = await bootstrapCache.get(loader, opts);
  setMarketBootstrapCache(data.envelope, data.catalog);
  return data;
}

export async function getMarketModeSnapshotCached(
  mode: MarketSnapshotMode,
  runId: string | null,
  loader: () => Promise<MarketModeSnapshot & { runId: string }>,
  opts?: { force?: boolean },
): Promise<MarketModeSnapshot & { runId: string }> {
  const force = opts?.force === true;
  const wantRun = runId?.trim() || "";
  const cache = modeSnapshotLoaders[mode];
  const cached = cache.peek();
  const workspaceHit = workspace.snapshots[mode];

  if (!force) {
    if (cached && (!wantRun || cached.runId === wantRun)) {
      return cached;
    }
    if (workspaceHit && (!wantRun || workspace.runId === wantRun)) {
      const run = wantRun || workspace.runId || "";
      if (run) {
        const packed = { ...workspaceHit, runId: run };
        cache.set(packed);
        return packed;
      }
    }
  }

  const data = await cache.get(loader, { force: true });
  workspace.snapshots = { ...workspace.snapshots, [mode]: data };
  workspace.runId = data.runId;
  return data;
}

export async function getStrategyDetailCached(
  strategyId: string,
  runId: string,
  loader: () => Promise<StrategyDetailResponse>,
  opts?: { force?: boolean },
): Promise<StrategyDetailResponse> {
  const key = detailKey(runId, strategyId);
  const force = opts?.force === true;
  if (!force) {
    const hit = strategyDetailByKey.get(key);
    if (hit) return hit.value;
  }
  const existing = strategyDetailInflight.get(key);
  if (existing) return existing;

  const pending = loader()
    .then((value) => {
      strategyDetailByKey.set(key, { value, fetchedAt: Date.now() });
      return value;
    })
    .finally(() => {
      strategyDetailInflight.delete(key);
    });
  strategyDetailInflight.set(key, pending);
  return pending;
}

export async function getTickerDetailCached(
  symbol: string,
  runId: string,
  loader: () => Promise<TickerDetailResponse>,
  opts?: { force?: boolean },
): Promise<TickerDetailResponse> {
  const key = detailKey(runId, symbol);
  const force = opts?.force === true;
  if (!force) {
    const hit = tickerDetailByKey.get(key);
    if (hit) return hit.value;
  }
  const existing = tickerDetailInflight.get(key);
  if (existing) return existing;

  const pending = loader()
    .then((value) => {
      tickerDetailByKey.set(key, { value, fetchedAt: Date.now() });
      return value;
    })
    .finally(() => {
      tickerDetailInflight.delete(key);
    });
  tickerDetailInflight.set(key, pending);
  return pending;
}
