import type { SearchProvider, SearchOptions } from '../../core/search/search.types.js';
import type { SearchResult } from '../../shared/types.js';
import type { AppConfig } from '../../shared/config.js';
import type { Logger } from '../../shared/logger.js';
import { ProviderError } from '../../shared/errors.js';

/**
 * Raw response shape from SearXNG's JSON API.
 * Only the fields we actually use are typed here.
 */
interface SearxngRawResult {
  title?: string;
  url?: string;
  content?: string;
  engine?: string;
}

interface SearxngResponse {
  results?: SearxngRawResult[];
  number_of_results?: number;
}

/**
 * SearXNG search provider.
 *
 * Connects to a SearXNG instance via its JSON API endpoint.
 * Maps raw SearXNG responses to normalized SearchResult objects.
 *
 * Configuration:
 * - SEARXNG_BASE_URL: Base URL of the SearXNG instance
 * - SEARXNG_TIMEOUT: Request timeout in milliseconds
 * - SEARXNG_SAFE_SEARCH: Safe search level (0=off, 1=moderate, 2=strict)
 */
export class SearxngProvider implements SearchProvider {
  readonly name = 'searxng';

  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {}

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const url = this.buildSearchUrl(query, options);

    this.logger.debug({ url: url.toString(), query }, 'SearXNG search request');

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(this.config.searxng.timeout),
      });
    } catch (error) {
      throw new ProviderError({
        provider: this.name,
        message: `SearXNG request failed: ${error instanceof Error ? error.message : String(error)}`,
        code: 'SEARXNG_REQUEST_FAILED',
        cause: error instanceof Error ? error : undefined,
      });
    }

    if (!response.ok) {
      throw new ProviderError({
        provider: this.name,
        message: `SearXNG returned HTTP ${response.status}`,
        code: 'SEARXNG_HTTP_ERROR',
      });
    }

    let data: SearxngResponse;
    try {
      data = (await response.json()) as SearxngResponse;
    } catch (error) {
      throw new ProviderError({
        provider: this.name,
        message: 'Failed to parse SearXNG JSON response',
        code: 'SEARXNG_PARSE_ERROR',
        cause: error instanceof Error ? error : undefined,
      });
    }

    const results = this.normalizeResults(data, options?.maxResults);

    this.logger.debug({
      resultCount: results.length,
      rawResultCount: data.results?.length ?? 0,
    }, 'SearXNG search completed');

    return results;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(this.config.searxng.baseUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Builds the SearXNG search URL with query parameters.
   */
  private buildSearchUrl(query: string, options?: SearchOptions): URL {
    const url = new URL('/search', this.config.searxng.baseUrl);

    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('safesearch', String(this.config.searxng.safeSearch));

    if (options?.language) {
      url.searchParams.set('language', options.language);
    }

    if (options?.categories && options.categories.length > 0) {
      url.searchParams.set('categories', options.categories.join(','));
    }

    return url;
  }

  /**
   * Normalizes raw SearXNG results into the standard SearchResult format.
   *
   * Filters out results missing title or URL, deduplicates by URL,
   * and limits to maxResults.
   */
  private normalizeResults(data: SearxngResponse, maxResults?: number): SearchResult[] {
    if (!data.results || !Array.isArray(data.results)) {
      return [];
    }

    const seenUrls = new Set<string>();
    const results: SearchResult[] = [];
    let position = 1;

    for (const raw of data.results) {
      // Skip incomplete results
      if (!raw.title?.trim() || !raw.url?.trim()) {
        continue;
      }

      // Deduplicate by URL
      if (seenUrls.has(raw.url)) {
        continue;
      }
      seenUrls.add(raw.url);

      results.push({
        title: raw.title.trim(),
        url: raw.url.trim(),
        snippet: raw.content?.trim() ?? '',
        source: raw.engine ?? 'searxng',
        position,
      });

      position++;

      // Respect maxResults limit
      if (maxResults && results.length >= maxResults) {
        break;
      }
    }

    return results;
  }
}
