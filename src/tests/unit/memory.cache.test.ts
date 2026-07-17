import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryCache } from '../../core/retrieval/cache/memory.cache.js';

describe('MemoryCache', () => {
  let cache: MemoryCache<string>;

  beforeEach(() => {
    cache = new MemoryCache<string>(10);
  });

  describe('get/set', () => {
    it('should return undefined for missing keys', () => {
      expect(cache.get('missing')).toBeUndefined();
    });

    it('should store and retrieve values', () => {
      cache.set('key1', 'value1', 60);
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for expired entries', async () => {
      cache.set('key1', 'value1', 0.001); // 1ms TTL
      await new Promise((r) => setTimeout(r, 10));
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should not cache when TTL is 0', () => {
      cache.set('key1', 'value1', 0);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should not cache when TTL is negative', () => {
      cache.set('key1', 'value1', -1);
      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return false for missing keys', () => {
      expect(cache.has('missing')).toBe(false);
    });

    it('should return true for existing keys', () => {
      cache.set('key1', 'value1', 60);
      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for expired keys', async () => {
      cache.set('key1', 'value1', 0.001);
      await new Promise((r) => setTimeout(r, 10));
      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('delete/clear', () => {
    it('should delete a specific entry', () => {
      cache.set('key1', 'value1', 60);
      cache.delete('key1');
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1', 60);
      cache.set('key2', 'value2', 60);
      cache.clear();
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entries when at capacity', () => {
      const smallCache = new MemoryCache<string>(3);

      smallCache.set('a', '1', 60);
      smallCache.set('b', '2', 60);
      smallCache.set('c', '3', 60);
      smallCache.set('d', '4', 60); // should evict 'a'

      expect(smallCache.get('a')).toBeUndefined();
      expect(smallCache.get('b')).toBe('2');
      expect(smallCache.get('d')).toBe('4');
    });

    it('should update LRU position on access', () => {
      const smallCache = new MemoryCache<string>(3);

      smallCache.set('a', '1', 60);
      smallCache.set('b', '2', 60);
      smallCache.set('c', '3', 60);

      // Access 'a' to move it to end
      smallCache.get('a');

      // Now 'b' should be evicted (oldest)
      smallCache.set('d', '4', 60);

      expect(smallCache.get('a')).toBe('1');
      expect(smallCache.get('b')).toBeUndefined();
    });
  });

  describe('stats', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'value1', 60);

      cache.get('key1'); // hit
      cache.get('missing1'); // miss
      cache.get('missing2'); // miss

      const stats = cache.stats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(stats.size).toBe(1);
    });

    it('should track evictions', () => {
      const smallCache = new MemoryCache<string>(2);

      smallCache.set('a', '1', 60);
      smallCache.set('b', '2', 60);
      smallCache.set('c', '3', 60); // evicts 'a'

      expect(smallCache.stats().evictions).toBe(1);
    });
  });

  describe('destroy', () => {
    it('should stop the sweep timer', () => {
      cache.destroy();
      // Should not throw or leak timers
    });
  });
});
