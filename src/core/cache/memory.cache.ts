import type { Cache, CacheStats } from './cache.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * In-memory LRU cache with per-entry TTL.
 *
 * Uses a Map for O(1) lookups with insertion-order iteration
 * for LRU eviction. Expired entries are cleaned up lazily on
 * access and periodically via a configurable sweep interval.
 */
export class MemoryCache<T> implements Cache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly maxEntries: number;
  private sweepTimer: ReturnType<typeof setInterval> | undefined;

  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;

  constructor(maxEntries: number = 500) {
    this.maxEntries = maxEntries;

    // Periodic sweep every 60 seconds to clean expired entries
    this.sweepTimer = setInterval(() => this.sweep(), 60_000);

    // Allow the process to exit even if the timer is active
    if (this.sweepTimer.unref) {
      this.sweepTimer.unref();
    }
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);

    if (!entry) {
      this.missCount++;
      return undefined;
    }

    if (this.isExpired(entry)) {
      this.entries.delete(key);
      this.evictionCount++;
      this.missCount++;
      return undefined;
    }

    // Move to end for LRU (Map maintains insertion order)
    this.entries.delete(key);
    this.entries.set(key, entry);

    this.hitCount++;
    return entry.value;
  }

  set(key: string, value: T, ttlSeconds: number): void {
    // TTL of 0 means don't cache
    if (ttlSeconds <= 0) {
      return;
    }

    // Delete first to reset insertion order (LRU position)
    this.entries.delete(key);

    // Evict oldest entries if at capacity
    while (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey);
        this.evictionCount++;
      }
    }

    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  has(key: string): boolean {
    const entry = this.entries.get(key);

    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.entries.delete(key);
      this.evictionCount++;
      return false;
    }

    return true;
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  stats(): CacheStats {
    return {
      hits: this.hitCount,
      misses: this.missCount,
      size: this.entries.size,
      evictions: this.evictionCount,
    };
  }

  /**
   * Stops the periodic sweep timer.
   * Call this during graceful shutdown.
   */
  destroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = undefined;
    }
  }

  /** Removes all expired entries */
  private sweep(): void {
    const now = Date.now();

    for (const [key, entry] of this.entries) {
      if (now >= entry.expiresAt) {
        this.entries.delete(key);
        this.evictionCount++;
      }
    }
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() >= entry.expiresAt;
  }
}
