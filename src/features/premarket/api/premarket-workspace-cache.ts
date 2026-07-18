/**
 * Module-level Premarket caches — survive PremarketPage unmount.
 */
import type { PremarketResultResponse } from "../types";
import type { DynamicCatalogResponse, DynamicRulesResponse, DynamicStrategy } from "./dynamic-strategy-client";
import { createAsyncCache } from "@/shared/lib/async-cache";

const catalogCache = createAsyncCache<DynamicCatalogResponse>({ ttlMs: 60_000 });
const rulesCache = createAsyncCache<DynamicRulesResponse>({ ttlMs: 60_000 });
const resultCache = createAsyncCache<PremarketResultResponse>({ ttlMs: 30_000 });

let lastStrategies: DynamicStrategy[] | null = null;

export function peekDynamicCatalogCache(): DynamicCatalogResponse | null {
  return catalogCache.peek();
}

export function peekDynamicRulesCache(): DynamicRulesResponse | null {
  return rulesCache.peek();
}

export function peekPremarketResultCache(): PremarketResultResponse | null {
  return resultCache.peek();
}

export function peekPremarketStrategiesCache(): DynamicStrategy[] | null {
  return lastStrategies;
}

export function setPremarketStrategiesCache(rows: DynamicStrategy[]): void {
  lastStrategies = rows;
}

export function invalidateDynamicCatalogCache(): void {
  catalogCache.invalidate();
  lastStrategies = null;
}

export function invalidateDynamicRulesCache(): void {
  rulesCache.invalidate();
}

export function invalidatePremarketResultCache(): void {
  resultCache.invalidate();
}

export async function getDynamicCatalogCached(
  loader: () => Promise<DynamicCatalogResponse>,
  opts?: { force?: boolean },
): Promise<DynamicCatalogResponse> {
  const data = await catalogCache.get(loader, opts);
  lastStrategies = (data.strategies ?? []) as DynamicStrategy[];
  return data;
}

export async function getDynamicRulesCached(
  loader: () => Promise<DynamicRulesResponse>,
  opts?: { force?: boolean },
): Promise<DynamicRulesResponse> {
  return rulesCache.get(loader, opts);
}

export async function getPremarketResultCached(
  loader: () => Promise<PremarketResultResponse>,
  opts?: { force?: boolean },
): Promise<PremarketResultResponse> {
  return resultCache.get(loader, opts);
}

export function setPremarketResultCache(result: PremarketResultResponse): void {
  resultCache.set(result);
}
