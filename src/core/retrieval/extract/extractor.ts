/**
 * Content extractor interface.
 *
 * Extractors transform raw content (HTML, PDF, etc.) into clean
 * Markdown suitable for LLM consumption.
 *
 * Each extractor declares which content types and URLs it can handle
 * via `canHandle()`. The extraction pipeline selects the first matching
 * extractor for a given request.
 */
export interface ContentExtractor {
  /** Human-readable name of this extractor */
  readonly name: string;

  /**
   * Extracts clean Markdown from raw content.
   *
   * @param content - Raw content (HTML string, buffer, etc.)
   * @param url - Original URL (used for resolving relative links)
   * @returns Extracted result with title and clean Markdown
   */
  extract(content: string, url: string): ExtractionResult;

  /**
   * Determines whether this extractor can handle the given content.
   *
   * @param url - The URL being fetched
   * @param contentType - The HTTP Content-Type header value
   * @returns true if this extractor should process the content
   */
  canHandle(url: string, contentType: string): boolean;
}

/** Result of content extraction */
export interface ExtractionResult {
  /** Extracted page title */
  readonly title: string;
  /** Clean Markdown content */
  readonly markdown: string;
  /** Word count of extracted content */
  readonly wordCount: number;
}
