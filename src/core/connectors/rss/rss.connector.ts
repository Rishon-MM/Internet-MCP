import { BaseConnector } from '../connector.js';
import { ConnectorError } from '../../../shared/errors.js';
import { JSDOM } from 'jsdom';

export interface FeedEntry {
  readonly title: string;
  readonly link: string;
  readonly pubDate: string;
  readonly summary: string;
}

export interface FeedResult {
  readonly title: string;
  readonly description: string;
  readonly link: string;
  readonly entries: readonly FeedEntry[];
}

/**
 * RssConnector — RSS/Atom feed reader.
 *
 * Fetches and parses RSS 2.0 and Atom feeds using JSDOM for XML parsing.
 * No external feed-parsing dependencies needed.
 */
export class RssConnector extends BaseConnector {
  readonly name = 'rss';
  readonly description = 'RSS/Atom feed reader';

  async readFeed(url: string, maxEntries: number = 20): Promise<FeedResult> {
    try {
      const xml = await this.fetchText(url);
      const dom = new JSDOM(xml, { contentType: 'text/xml' });
      const doc = dom.window.document;

      // Detect feed type and parse accordingly
      const rssChannel = doc.querySelector('channel');
      const atomFeed = doc.querySelector('feed');

      if (rssChannel) {
        return this.parseRss(rssChannel, maxEntries);
      } else if (atomFeed) {
        return this.parseAtom(atomFeed, maxEntries);
      } else {
        throw new Error('Unable to detect RSS 2.0 or Atom feed format');
      }
    } catch (error) {
      throw new ConnectorError({
        connector: this.name,
        message: `Failed to read feed from ${url}`,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  private parseRss(channel: Element, maxEntries: number): FeedResult {
    const items = Array.from(channel.querySelectorAll('item')).slice(0, maxEntries);

    return {
      title: channel.querySelector('title')?.textContent?.trim() ?? 'Untitled Feed',
      description: channel.querySelector('description')?.textContent?.trim() ?? '',
      link: channel.querySelector('link')?.textContent?.trim() ?? '',
      entries: items.map((item) => ({
        title: item.querySelector('title')?.textContent?.trim() ?? 'Untitled',
        link: item.querySelector('link')?.textContent?.trim() ?? '',
        pubDate: item.querySelector('pubDate')?.textContent?.trim() ?? '',
        summary: this.cleanSummary(
          item.querySelector('description')?.textContent?.trim() ?? '',
        ),
      })),
    };
  }

  private parseAtom(feed: Element, maxEntries: number): FeedResult {
    const entries = Array.from(feed.querySelectorAll('entry')).slice(0, maxEntries);

    return {
      title: feed.querySelector('title')?.textContent?.trim() ?? 'Untitled Feed',
      description: feed.querySelector('subtitle')?.textContent?.trim() ?? '',
      link: feed.querySelector('link')?.getAttribute('href') ?? '',
      entries: entries.map((entry) => ({
        title: entry.querySelector('title')?.textContent?.trim() ?? 'Untitled',
        link: entry.querySelector('link')?.getAttribute('href') ?? '',
        pubDate: entry.querySelector('updated')?.textContent?.trim()
          ?? entry.querySelector('published')?.textContent?.trim() ?? '',
        summary: this.cleanSummary(
          entry.querySelector('summary')?.textContent?.trim()
            ?? entry.querySelector('content')?.textContent?.trim() ?? '',
        ),
      })),
    };
  }

  /**
   * Strips HTML tags and truncates summary to a reasonable length.
   */
  private cleanSummary(raw: string): string {
    // Strip HTML tags
    const text = raw.replace(/<[^>]+>/g, '').trim();
    // Collapse whitespace
    const cleaned = text.replace(/\s+/g, ' ');
    // Truncate to ~300 chars
    if (cleaned.length > 300) {
      return cleaned.slice(0, 300).trimEnd() + '...';
    }
    return cleaned;
  }
}
