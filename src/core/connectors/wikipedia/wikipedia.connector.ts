import { BaseConnector } from '../connector.js';
import { ConnectorError } from '../../../shared/errors.js';

interface WikipediaSummaryResponse {
  title: string;
  displaytitle: string;
  description: string;
  extract: string;
  extract_html: string;
  content_urls: {
    desktop: { page: string };
    mobile: { page: string };
  };
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
}

interface WikipediaSearchResponse {
  query: {
    search: Array<{
      title: string;
      pageid: number;
      snippet: string;
      wordcount: number;
    }>;
    searchinfo: {
      totalhits: number;
    };
  };
}

export interface WikipediaSummary {
  readonly title: string;
  readonly description: string;
  readonly extract: string;
  readonly url: string;
  readonly thumbnail?: string;
}

export interface WikipediaSearchResult {
  readonly title: string;
  readonly pageId: number;
  readonly snippet: string;
  readonly wordCount: number;
}

export interface WikipediaSearchResults {
  readonly query: string;
  readonly totalHits: number;
  readonly results: readonly WikipediaSearchResult[];
}

/**
 * WikipediaConnector — article summaries and search via Wikipedia REST API.
 *
 * Free, no API key required. Uses the Wikimedia REST API and MediaWiki Action API.
 * https://en.wikipedia.org/api/rest_v1/
 */
export class WikipediaConnector extends BaseConnector {
  readonly name = 'wikipedia';
  readonly description = 'Wikipedia article summaries and search';

  /**
   * Get a summary of a Wikipedia article by title.
   */
  async getSummary(title: string, language: string = 'en'): Promise<WikipediaSummary> {
    const encodedTitle = encodeURIComponent(title.replace(/ /g, '_'));
    const url = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`;

    try {
      const data = await this.fetchJson<WikipediaSummaryResponse>(url);

      return {
        title: data.title,
        description: data.description ?? '',
        extract: data.extract,
        url: data.content_urls.desktop.page,
        thumbnail: data.thumbnail?.source,
      };
    } catch (error) {
      throw new ConnectorError({
        connector: this.name,
        message: `Failed to fetch Wikipedia summary for "${title}"`,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Search Wikipedia articles.
   */
  async search(query: string, language: string = 'en', limit: number = 10): Promise<WikipediaSearchResults> {
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: String(limit),
      format: 'json',
      origin: '*',
    });

    const url = `https://${language}.wikipedia.org/w/api.php?${params.toString()}`;

    try {
      const data = await this.fetchJson<WikipediaSearchResponse>(url);

      return {
        query,
        totalHits: data.query.searchinfo.totalhits,
        results: data.query.search.map((item) => ({
          title: item.title,
          pageId: item.pageid,
          snippet: item.snippet.replace(/<[^>]+>/g, '').trim(),
          wordCount: item.wordcount,
        })),
      };
    } catch (error) {
      throw new ConnectorError({
        connector: this.name,
        message: `Failed to search Wikipedia for "${query}"`,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
}
