import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { FetchService } from '../../core/retrieval/fetch/fetch.service.js';
import type { Logger } from '../../shared/logger.js';

/**
 * Registers the `open_url` tool on the MCP server.
 *
 * This tool fetches a webpage and returns its content as clean Markdown.
 * All noise (scripts, styles, navigation, ads) is stripped automatically.
 * The model simply provides a URL, and the server handles fetching,
 * extraction, and formatting.
 *
 * Input:  { url: string }
 * Output: Clean Markdown content with page title
 */
export function registerOpenUrlTool(
  server: McpServer,
  fetchService: FetchService,
  logger: Logger,
): void {
  server.registerTool(
    'open_url',
    {
      title: 'Open URL',
      description:
        'Fetch a webpage and return its content as clean Markdown. Strips navigation, ads, scripts, and other noise. Use this to read the content of a specific webpage.',
      inputSchema: z.object({
        url: z
          .url('Must be a valid URL')
          .describe('The URL of the webpage to fetch'),
      }),
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ url }) => {
      try {
        const page = await fetchService.fetch(url);
        const text = formatPageContent(page);

        return {
          content: [{ type: 'text', text }],
        };
      } catch (error) {
        logger.error({
          tool: 'open_url',
          url,
          error: error instanceof Error ? error.message : String(error),
        }, 'open_url tool error');

        return {
          content: [{ type: 'text', text: `Failed to fetch URL: ${error instanceof Error ? error.message : 'Unknown error'}` }],
          isError: true,
        };
      }
    },
  );

  logger.debug('Registered tool: open_url');
}

/**
 * Formats extracted page content as clean, LLM-friendly Markdown.
 */
function formatPageContent(page: {
  title: string;
  url: string;
  markdown: string;
  wordCount: number;
  cached: boolean;
  latencyMs: number;
}): string {
  const lines: string[] = [
    `# ${page.title}`,
    `**Source:** ${page.url}`,
    '',
    page.markdown,
    '',
    '---',
    `*${page.wordCount} words (${page.latencyMs}ms${page.cached ? ', cached' : ''})*`,
  ];

  return lines.join('\n');
}
