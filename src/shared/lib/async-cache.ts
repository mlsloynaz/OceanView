/**
 * Session in-memory cache with in-flight dedupe for navigation remounts.
 * Stale-while-revalidate: peek() for instant UI; get({ force: true }) refreshes.
 */

export type AsyncCacheOptions = {
  /** Soft TTL — within this window, get() without force returns cached value. Default 60s. */
  ttlMs?: number;
};

export function createAsyncCache<T>(options: AsyncCacheOptions = {}) {
  const ttlMs = options.ttlMs ?? 60_000;
  let entry: { value: T; fetchedAt: number } | null = null;
  let inflight: Promise<T> | null = null;

  return {
    peek(): T | null {
      return entry ? entry.value : null;
    },

    isFresh(): boolean {
      return Boolean(entry && Date.now() - entry.fetchedAt < ttlMs);
    },

    set(value: T): void {
      entry = { value, fetchedAt: Date.now() };
    },

    invalidate(): void {
      entry = null;
      inflight = null;
    },

    /**
     * Return cached value when fresh (unless force), else share one in-flight load.
     */
    async get(
      loader: () => Promise<T>,
      opts?: { force?: boolean },
    ): Promise<T> {
      const force = opts?.force === true;
      if (!force && entry && Date.now() - entry.fetchedAt < ttlMs) {
        return entry.value;
      }
      if (inflight) return inflight;

      const pending = loader()
        .then((value) => {
          entry = { value, fetchedAt: Date.now() };
          return value;
        })
        .finally(() => {
          if (inflight === pending) inflight = null;
        });
      inflight = pending;
      return pending;
    },
  };
}
