import type { Logger } from '../../../shared/logger.js';
import type { AppConfig } from '../../../shared/config.js';
import type { PageContent } from '../../../shared/types.js';
import type { Cache } from '../cache/cache.js';
import type { ContentExtractor } from '../extract/extractor.js';
import { FetchError } from '../../../shared/errors.js';
import { elapsed, generateRequestId, isValidUrl, detectContentType } from '../../../shared/utils.js';
import { truncateMarkdown } from '../extract/markdown.js';

/** User-Agent strings rotated for reliable fetching */
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
] as const;

/**
 * FetchService — core business logic for fetching and extracting web pages.
 *
 * Pipeline:
 * 1. Validate URL
 * 2. Check cache
 * 3. Fetch page with timeout and User-Agent rotation
 * 4. Detect content type
 * 5. Extract clean Markdown via appropriate extractor
 * 6. Cache with content-type-specific TTL
 * 7. Return PageContent
 *
 * All dependencies are injected via constructor.
 */
export class FetchService {
  constructor(
    private readonly extractor: ContentExtractor,
    private readonly cache: Cache<PageContent>,
    private readonly logger: Logger,
    private readonly config: AppConfig,
  ) {}

  /**
   * Fetches a URL and returns clean Markdown content.
   *
   * @param url - The URL to fetch
   * @returns Extracted page content with metadata
   */
  async fetch(url: string): Promise<PageContent> {
    const requestId = generateRequestId();
    const startTime = performance.now();

    const reqLogger = this.logger.child({
      requestId,
      tool: 'open_url',
      url,
    });

    // 1. Validate URL
    if (!isValidUrl(url)) {
      throw new FetchError({
        url,
        message: `Invalid URL: ${url}`,
        code: 'INVALID_URL',
      });
    }

    // 2. Check cache
    const cacheKey = `page:${url}`;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      const latencyMs = elapsed(startTime);

      reqLogger.info({
        cacheStatus: 'hit',
        contentType: cached.contentType,
        wordCount: cached.wordCount,
        latencyMs,
      }, 'Fetch completed (cache hit)');

      return { ...cached, cached: true, latencyMs };
    }

    // 3. Fetch page
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.selectUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(this.config.fetch.timeout),
        redirect: 'follow',
      });
    } catch (error) {
      const latencyMs = elapsed(startTime);

      reqLogger.error({
        cacheStatus: 'miss',
        latencyMs,
        error: error instanceof Error ? error.message : String(error),
      }, 'Fetch failed');

      throw new FetchError({
        url,
        message: `Failed to fetch ${url}`,
        code: 'FETCH_FAILED',
        cause: error instanceof Error ? error : undefined,
      });
    }

    // Check response status
    if (!response.ok) {
      const latencyMs = elapsed(startTime);

      reqLogger.warn({
        cacheStatus: 'miss',
        statusCode: response.status,
        latencyMs,
      }, 'Fetch returned non-OK status');

      throw new FetchError({
        url,
        message: `HTTP ${response.status} for ${url}`,
        code: 'HTTP_ERROR',
      });
    }

    // 4. Read body with size limit
    const contentTypeHeader = response.headers.get('content-type') ?? 'text/html';
    const html = await this.readBody(response, url);

    // 5. Detect content type for TTL
    const contentType = detectContentType(url, contentTypeHeader);

    // 6. Extract content
    if (!this.extractor.canHandle(url, contentTypeHeader)) {
      throw new FetchError({
        url,
        message: `No extractor available for content type: ${contentTypeHeader}`,
        code: 'UNSUPPORTED_CONTENT_TYPE',
      });
    }

    const extracted = this.extractor.extract(html, url);

    // 7. Truncate if needed (keep LLM-friendly)
    const markdown = truncateMarkdown(extracted.markdown, this.config.fetch.maxSize);

    const latencyMs = elapsed(startTime);

    const pageContent: PageContent = {
      url,
      title: extracted.title,
      markdown,
      contentType,
      wordCount: extracted.wordCount,
      cached: false,
      latencyMs,
    };

    // 8. Cache with content-type-specific TTL
    const ttl = this.getTtlForContentType(contentType);
    this.cache.set(cacheKey, pageContent, ttl);

    reqLogger.info({
      cacheStatus: 'miss',
      contentType,
      wordCount: extracted.wordCount,
      titleExtracted: extracted.title,
      latencyMs,
    }, 'Fetch completed');

    return pageContent;
  }

  /**
   * Reads response body with a size limit to prevent memory issues.
   */
  private async readBody(response: Response, url: string): Promise<string> {
    const contentLength = response.headers.get('content-length');

    if (contentLength && Number(contentLength) > this.config.fetch.maxSize) {
      throw new FetchError({
        url,
        message: `Content too large: ${contentLength} bytes (max: ${this.config.fetch.maxSize})`,
        code: 'CONTENT_TOO_LARGE',
      });
    }

    const text = await response.text();

    if (text.length > this.config.fetch.maxSize) {
      return text.slice(0, this.config.fetch.maxSize);
    }

    return text;
  }

  /**
   * Selects a TTL from config based on content type.
   * All values come from environment — never hardcoded.
   */
  private getTtlForContentType(contentType: 'page' | 'doc' | 'pdf'): number {
    switch (contentType) {
      case 'pdf':
        return this.config.cache.pdfTtl;
      case 'doc':
        return this.config.cache.docTtl;
      case 'page':
        return this.config.cache.pageTtl;
    }
  }

  /**
   * Rotates User-Agent strings to reduce blocking.
   */
  private selectUserAgent(): string {
    const index = Math.floor(Math.random() * USER_AGENTS.length);
    return USER_AGENTS[index]!;
  }
}
