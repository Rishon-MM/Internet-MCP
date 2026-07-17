import type { Logger } from '../../../shared/logger.js';
import type { AppConfig } from '../../../shared/config.js';
import type { SearchResponse, SearchResult } from '../../../shared/types.js';
import type { Cache } from '../cache/cache.js';
import type { SearchProvider, SearchOptions } from './search.types.js';
import { ProviderError } from '../../../shared/errors.js';
import { elapsed, generateRequestId } from '../../../shared/utils.js';

/**
 * SearchService — core business logic for web search.
 *
 * Orchestrates the search pipeline:
 * 1. Check cache for existing results
 * 2. Call the search provider
 * 3. Store results in cache
 * 4. Return normalized response
 *
 * All dependencies are injected via constructor — no global state.
 */
export class SearchService {
  constructor(
    private readonly provider: SearchProvider,
    private readonly cache: Cache<SearchResponse>,
    private readonly logger: Logger,
    private readonly config: AppConfig,
  ) {}

  /**
   * Performs a web search and returns normalized results.
   *
   * @param query - The search query
   * @param options - Optional search parameters
   * @returns Normalized search response with cache and latency metadata
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResponse> {
    const requestId = generateRequestId();
    const startTime = performance.now();

    const reqLogger = this.logger.child({
      requestId,
      tool: 'search_web',
      provider: this.provider.name,
      query,
    });

    // 1. Check cache
    const cacheKey = this.buildCacheKey(query, options);
    const cached = this.cache.get(cacheKey);

    if (cached) {
      const latencyMs = elapsed(startTime);

      reqLogger.info({
        cacheStatus: 'hit',
        resultCount: cached.results.length,
        latencyMs,
      }, 'Search completed (cache hit)');

      return { ...cached, cached: true, latencyMs };
    }

    // 2. Call provider
    let results: SearchResult[];
    try {
      results = await this.provider.search(query, options);
    } catch (error) {
      const latencyMs = elapsed(startTime);

      reqLogger.error({
        cacheStatus: 'miss',
        latencyMs,
        error: error instanceof Error ? error.message : String(error),
      }, 'Search failed');

      throw new ProviderError({
        provider: this.provider.name,
        message: `Search failed for query "${query}"`,
        code: 'SEARCH_FAILED',
        cause: error instanceof Error ? error : undefined,
      });
    }

    // 3. Build response
    const latencyMs = elapsed(startTime);
    const response: SearchResponse = {
      query,
      results,
      totalResults: results.length,
      cached: false,
      provider: this.provider.name,
      latencyMs,
    };

    // 4. Cache response
    this.cache.set(cacheKey, response, this.config.cache.searchTtl);

    reqLogger.info({
      cacheStatus: 'miss',
      resultCount: results.length,
      latencyMs,
    }, 'Search completed');

    return response;
  }

  /**
   * Builds a deterministic cache key from the query and options.
   */
  private buildCacheKey(query: string, options?: SearchOptions): string {
    const normalized = query.toLowerCase().trim();
    const optionsSuffix = options
      ? `:${options.maxResults ?? ''}:${options.language ?? ''}:${options.categories?.join(',') ?? ''}`
      : '';
    return `search:${normalized}${optionsSuffix}`;
  }
}
