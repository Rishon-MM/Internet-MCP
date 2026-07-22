import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { WikipediaConnector } from '../../core/connectors/wikipedia/wikipedia.connector.js';
import type { Logger } from '../../shared/logger.js';

export function registerWikipediaTool(
  server: McpServer,
  connector: WikipediaConnector,
  logger: Logger,
): void {
  server.registerTool(
    'wikipedia',
    {
      title: 'Wikipedia Lookup',
      description:
        'Search Wikipedia or get a summary of a specific article. Provide a "query" to search, or a "title" to get a direct article summary. Supports multiple languages.',
      inputSchema: z.object({
        query: z.string().optional().describe('Search query to find Wikipedia articles'),
        title: z.string().optional().describe('Exact article title to get a summary (e.g., "Albert Einstein")'),
        language: z.string().length(2).default('en').describe('Wikipedia language code (default: "en")'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ query, title, language }) => {
      try {
        if (title) {
          // Direct article summary
          const result = await connector.getSummary(title, language);

          const lines: string[] = [
            `# ${result.title}`,
          ];

          if (result.description) {
            lines.push(`*${result.description}*`);
          }

          lines.push('', result.extract, '', '---');
          lines.push(`**Source:** [${result.title} — Wikipedia](${result.url})`);
          lines.push('*Data from Wikipedia*');

          return { content: [{ type: 'text', text: lines.join('\n') }] };

        } else if (query) {
          // Search Wikipedia
          const results = await connector.search(query, language);

          if (results.results.length === 0) {
            return { content: [{ type: 'text', text: `No Wikipedia articles found for "${query}"` }] };
          }

          const lines: string[] = [
            `## Wikipedia Results for "${query}"`,
            '',
          ];

          for (const [i, r] of results.results.entries()) {
            const articleUrl = `https://${language}.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`;
            lines.push(`### ${i + 1}. ${r.title}`);
            lines.push(`**URL:** ${articleUrl}`);
            if (r.snippet) lines.push(r.snippet);
            lines.push(`*${r.wordCount.toLocaleString()} words*`);
            lines.push('');
          }

          lines.push('---');
          lines.push(`*${results.totalHits.toLocaleString()} total results from Wikipedia*`);

          return { content: [{ type: 'text', text: lines.join('\n') }] };
        } else {
          return {
            content: [{ type: 'text', text: 'Please provide either a "query" to search Wikipedia, or a "title" to get an article summary.' }],
            isError: true,
          };
        }
      } catch (error) {
        logger.error({ tool: 'wikipedia', query, title, language, error: error instanceof Error ? error.message : String(error) }, 'wikipedia error');
        return { content: [{ type: 'text', text: `Wikipedia lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}` }], isError: true };
      }
    },
  );

  logger.debug('Registered tool: wikipedia');
}
