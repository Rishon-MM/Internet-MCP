import type { SearchResult } from '../../shared/types.js';

/**
 * Search provider interface.
 *
 * Every search provider (SearXNG, Brave, Tavily, etc.) implements
 * this interface. Adding a new provider never requires changing
 * business logic — just implement this interface and register it.
 */
export interface SearchProvider {
  /** Unique provider name (e.g., 'searxng', 'brave') */
  readonly name: string;

  /**
   * Execute a search query and return normalized results.
   *
   * @param query - The search query string
   * @param options - Optional search parameters
   * @returns Array of normalized search results
   */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * Check if this provider is currently available and healthy.
   *
   * Used by ProviderManager for health-based routing and fallback.
   */
  isAvailable(): Promise<boolean>;
}

/** Optional parameters for search queries */
export interface SearchOptions {
  /** Maximum number of results to return */
  readonly maxResults?: number;
  /** Language code (e.g., 'en', 'de', 'fr') */
  readonly language?: string;
  /** Search categories (e.g., 'general', 'news', 'images') */
  readonly categories?: readonly string[];
}
