/**
 * Module-level Premarket caches — survive PremarketPage unmount.
 *
 * Evaluate **results** are kept until explicitly invalidated (new assessment),
 * not by a short TTL — so navigating back / opening panes is instant.
 */
import type { PremarketResultResponse } from "../types";
import type { DynamicCatalogResponse, DynamicRulesResponse, DynamicStrategy } from "./dynamic-strategy-client";
import { createAsyncCache } from "@/shared/lib/async-cache";

const catalogCache = createAsyncCache<DynamicCatalogResponse>({ ttlMs: 60_000 });
const rulesCache = createAsyncCache<DynamicRulesResponse>({ ttlMs: 60_000 });
/** No soft TTL — only invalidatePremarketResultCache() clears this. */
const resultCache = createAsyncCache<PremarketResultResponse>({
  ttlMs: Number.POSITIVE_INFINITY,
});

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

export function peekPremarketResultRunId(): string | null {
  const runId = resultCache.peek()?.runId;
  return typeof runId === "string" && runId.trim() ? runId.trim() : null;
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

/**
 * Return cached evaluate result when it matches the requested run (or latest).
 * Network only when missing, mismatched runId, or force.
 */
export async function getPremarketResultCached(
  loader: () => Promise<PremarketResultResponse>,
  opts?: { force?: boolean; runId?: string | null },
): Promise<PremarketResultResponse> {
  const force = opts?.force === true;
  const wantRun = typeof opts?.runId === "string" ? opts.runId.trim() : "";
  const cached = resultCache.peek();

  if (!force && cached) {
    if (!wantRun || cached.runId === wantRun) {
      return cached;
    }
  }

  return resultCache.get(loader, { force: true });
}

export function setPremarketResultCache(result: PremarketResultResponse): void {
  resultCache.set(result);
}
