/**
 * Cache interface — the contract for all cache implementations.
 *
 * TTL is passed per `set()` call, never hardcoded in the implementation.
 * This allows the caller to use content-type-specific TTLs from config.
 */
export interface Cache<T> {
  /** Retrieve a cached value by key. Returns undefined on miss. */
  get(key: string): T | undefined;

  /** Store a value with a TTL in seconds. TTL of 0 disables caching for this entry. */
  set(key: string, value: T, ttlSeconds: number): void;

  /** Check if a non-expired entry exists for the key. */
  has(key: string): boolean;

  /** Remove a specific entry. */
  delete(key: string): void;

  /** Remove all entries. */
  clear(): void;

  /** Returns current cache statistics. */
  stats(): CacheStats;
}

/** Cache performance statistics for structured logging */
export interface CacheStats {
  /** Total cache hits */
  readonly hits: number;
  /** Total cache misses */
  readonly misses: number;
  /** Current number of entries */
  readonly size: number;
  /** Total entries evicted (expired or LRU) */
  readonly evictions: number;
}
