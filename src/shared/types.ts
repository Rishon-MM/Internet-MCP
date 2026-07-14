/**
 * Core domain types shared across all layers.
 *
 * These types define the contracts between core services,
 * providers, and the MCP protocol layer. They are not tied
 * to any specific provider or transport.
 */

/** A single search result from any provider */
export interface SearchResult {
  /** Page title */
  readonly title: string;
  /** Full URL */
  readonly url: string;
  /** Text snippet / description */
  readonly snippet: string;
  /** Provider or search engine that returned this result */
  readonly source: string;
  /** Position in the result list (1-based) */
  readonly position: number;
}

/** Complete response from a search operation */
export interface SearchResponse {
  /** The original query string */
  readonly query: string;
  /** Ordered list of search results */
  readonly results: readonly SearchResult[];
  /** Total number of results found */
  readonly totalResults: number;
  /** Whether this response was served from cache */
  readonly cached: boolean;
  /** Which provider served this response */
  readonly provider: string;
  /** Total operation latency in milliseconds */
  readonly latencyMs: number;
}

/** Extracted and cleaned page content */
export interface PageContent {
  /** Original page URL */
  readonly url: string;
  /** Extracted page title */
  readonly title: string;
  /** Clean Markdown content */
  readonly markdown: string;
  /** Content type classification */
  readonly contentType: ContentType;
  /** Word count of extracted content */
  readonly wordCount: number;
  /** Whether this content was served from cache */
  readonly cached: boolean;
  /** Total operation latency in milliseconds */
  readonly latencyMs: number;
}

/** Content type classification for cache TTL selection */
export type ContentType = 'page' | 'doc' | 'pdf';

/** Per-request context for structured logging */
export interface RequestContext {
  /** Unique identifier for this request */
  readonly requestId: string;
  /** Timestamp when the request started */
  readonly startedAt: number;
}
