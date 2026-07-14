import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { SearchService } from '../../core/search/search.service.js';
import type { Logger } from '../../shared/logger.js';

/**
 * Registers the `search_web` tool on the MCP server.
 *
 * This tool allows LLMs to search the internet for current information.
 * The model expresses intent (a query), and the server handles all
 * retrieval complexity internally: provider selection, caching,
 * result ranking, and response formatting.
 *
 * Input:  { query: string }
 * Output: Formatted Markdown with search results
 */
export function registerSearchTool(
  server: McpServer,
  searchService: SearchService,
  logger: Logger,
): void {
  server.registerTool(
    'search_web',
    {
      title: 'Search the Web',
      description:
        'Search the internet for current information. Returns relevant results with titles, URLs, and snippets. Use this when you need up-to-date information from the web.',
      inputSchema: z.object({
        query: z
          .string()
          .min(1, 'Query cannot be empty')
          .max(500, 'Query too long (max 500 characters)')
          .describe('The search query'),
      }),
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ query }) => {
      try {
        const response = await searchService.search(query);
        const text = formatSearchResults(response.query, response.results, response);

        return {
          content: [{ type: 'text', text }],
        };
      } catch (error) {
        logger.error({
          tool: 'search_web',
          query,
          error: error instanceof Error ? error.message : String(error),
        }, 'search_web tool error');

        return {
          content: [{ type: 'text', text: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}` }],
          isError: true,
        };
      }
    },
  );

  logger.debug('Registered tool: search_web');
}

/**
 * Formats search results as clean, LLM-friendly Markdown.
 */
function formatSearchResults(
  query: string,
  results: readonly { title: string; url: string; snippet: string; position: number }[],
  meta: { provider: string; cached: boolean; latencyMs: number; totalResults: number },
): string {
  if (results.length === 0) {
    return `No results found for: "${query}"`;
  }

  const lines: string[] = [
    `## Search Results for: "${query}"`,
    '',
  ];

  for (const result of results) {
    lines.push(`### ${result.position}. ${result.title}`);
    lines.push(`**URL:** ${result.url}`);
    if (result.snippet) {
      lines.push(`${result.snippet}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(`*${meta.totalResults} results via ${meta.provider} (${meta.latencyMs}ms${meta.cached ? ', cached' : ''})*`);

  return lines.join('\n');
}
