import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { SearchService } from '../core/search/search.service.js';
import type { FetchService } from '../core/fetch/fetch.service.js';
import type { Logger } from '../shared/logger.js';
import { registerSearchTool } from './tools/search.tool.js';
import { registerOpenUrlTool } from './tools/open-url.tool.js';

/**
 * Registers all MCP tools on the server.
 *
 * This is the single place where tools are wired to core services.
 * Each tool is a thin adapter — no business logic here.
 */
export function registerTools(
  server: McpServer,
  searchService: SearchService,
  fetchService: FetchService,
  logger: Logger,
): void {
  registerSearchTool(server, searchService, logger);
  registerOpenUrlTool(server, fetchService, logger);

  logger.info('All MCP tools registered');
}

export { z };
