import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { RssConnector } from '../../core/connectors/rss/rss.connector.js';
import type { Logger } from '../../shared/logger.js';

export function registerRssTool(
  server: McpServer,
  connector: RssConnector,
  logger: Logger,
): void {
  server.registerTool(
    'read_rss',
    {
      title: 'Read RSS/Atom Feed',
      description:
        'Read and parse an RSS or Atom feed. Returns feed title and entries with titles, links, dates, and summaries.',
      inputSchema: z.object({
        url: z.url('Must be a valid URL').describe('URL of the RSS/Atom feed'),
        max_entries: z.number().int().min(1).max(50).default(10).describe('Maximum entries to return (default: 10)'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ url, max_entries }) => {
      try {
        const result = await connector.readFeed(url, max_entries);

        const lines: string[] = [
          `## ${result.title}`,
        ];

        if (result.description) {
          lines.push(`*${result.description}*`);
        }
        lines.push('');

        for (const [i, entry] of result.entries.entries()) {
          lines.push(`### ${i + 1}. ${entry.title}`);
          if (entry.link) lines.push(`**URL:** ${entry.link}`);
          if (entry.pubDate) lines.push(`**Published:** ${entry.pubDate}`);
          if (entry.summary) lines.push(`${entry.summary}`);
          lines.push('');
        }

        lines.push('---', `*${result.entries.length} entries from ${result.link || url}*`);

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (error) {
        logger.error({ tool: 'read_rss', url, error: error instanceof Error ? error.message : String(error) }, 'read_rss error');
        return { content: [{ type: 'text', text: `RSS feed reading failed: ${error instanceof Error ? error.message : 'Unknown error'}` }], isError: true };
      }
    },
  );

  logger.debug('Registered tool: read_rss');
}
