#!/usr/bin/env node

/**
 * Internet MCP — Entry Point & Composition Root
 *
 * This is the only place where dependencies are wired together.
 * Every service receives its dependencies via constructor injection.
 * No global state. No service locators.
 *
 * Startup flow:
 * 1. Load and validate configuration
 * 2. Create logger
 * 3. Create cache instances
 * 4. Create providers and register them
 * 5. Create core services with injected dependencies
 * 6. Create MCP server and register tools
 * 7. Connect transport (stdio or HTTP)
 * 8. Set up graceful shutdown
 */

import { loadConfig } from './shared/config.js';
import { createLogger } from './shared/logger.js';
import { MemoryCache } from './core/cache/memory.cache.js';
import { HtmlExtractor } from './core/extract/html.extractor.js';
import { SearchService } from './core/search/search.service.js';
import { FetchService } from './core/fetch/fetch.service.js';
import { ProviderManager } from './providers/provider.js';
import { SearxngProvider } from './providers/searxng/searxng.provider.js';
import { createMcpServer, connectStdioTransport, connectHttpTransport } from './mcp/server.js';
import { registerTools } from './mcp/registry.js';
import type { SearchResponse, PageContent } from './shared/types.js';

async function main(): Promise<void> {
  // ── 1. Configuration ────────────────────────────
  const config = loadConfig();

  // ── 2. Logger ───────────────────────────────────
  const logger = createLogger(config);

  logger.info({
    transport: config.transport.type,
    provider: config.provider.search,
    cacheMaxEntries: config.cache.maxEntries,
  }, 'Internet MCP starting');

  // ── 3. Cache ────────────────────────────────────
  const searchCache = new MemoryCache<SearchResponse>(config.cache.maxEntries);
  const pageCache = new MemoryCache<PageContent>(config.cache.maxEntries);

  // ── 4. Providers ────────────────────────────────
  const providerManager = new ProviderManager(config, logger);

  // Register SearXNG provider
  const searxngProvider = new SearxngProvider(config, logger);
  providerManager.register(searxngProvider);

  // Get the active provider based on config
  const activeProvider = providerManager.getActiveProvider();

  // ── 5. Core Services ────────────────────────────
  const extractor = new HtmlExtractor();

  const searchService = new SearchService(
    activeProvider,
    searchCache,
    logger,
    config,
  );

  const fetchService = new FetchService(
    extractor,
    pageCache,
    logger,
    config,
  );

  // ── 6. MCP Server Factory ──────────────────────────────
  const createConfiguredServer = () => {
    const server = createMcpServer(config, logger);
    registerTools(server, searchService, fetchService, logger);
    return server;
  };

  // ── 7. Connect Transport ───────────────────────
  let transportCloser: { close: () => Promise<void> };

  if (config.transport.type === 'http') {
    transportCloser = await connectHttpTransport(createConfiguredServer, config, logger);
  } else {
    const mcpServer = createConfiguredServer();
    transportCloser = await connectStdioTransport(mcpServer, logger);
  }

  // ── 8. Graceful Shutdown ───────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutdown signal received');

    // Log final cache stats
    logger.info({
      searchCache: searchCache.stats(),
      pageCache: pageCache.stats(),
    }, 'Final cache statistics');

    // Cleanup
    searchCache.destroy();
    pageCache.destroy();

    await transportCloser.close();
    logger.info('Internet MCP stopped');

    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  logger.info({
    transport: config.transport.type,
    provider: activeProvider.name,
    tools: ['search_web', 'open_url'],
  }, 'Internet MCP ready');
}

main().catch((error: unknown) => {
  // Last-resort error handler — config or logger may not be available
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  process.stderr.write(`Fatal error: ${message}\n`);
  if (stack) {
    process.stderr.write(`${stack}\n`);
  }
  process.exit(1);
});
