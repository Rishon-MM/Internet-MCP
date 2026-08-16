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
 * 6. Create connectors
 * 7. Create MCP server and register tools
 * 8. Connect transport (stdio or HTTP)
 * 9. Set up graceful shutdown
 */

import { loadConfig } from './shared/config.js';
import { createLogger } from './shared/logger.js';
import { MemoryCache } from './core/retrieval/cache/memory.cache.js';
import { HtmlExtractor } from './core/retrieval/extract/html.extractor.js';
import { SearchService } from './core/retrieval/search/search.service.js';
import { FetchService } from './core/retrieval/fetch/fetch.service.js';
import { BrowserRenderer } from './core/retrieval/fetch/browser.renderer.js';
import { ProviderManager } from './providers/provider.js';
import { SearxngProvider } from './providers/searxng/searxng.provider.js';
import { createMcpServer, connectStdioTransport, connectHttpTransport } from './mcp/server.js';
import { registerTools } from './mcp/registry.js';
import type { SearchResponse, PageContent } from './shared/types.js';

// Connectors
import { WeatherConnector } from './core/connectors/weather/weather.connector.js';
import { TimeConnector } from './core/connectors/time/time.connector.js';
import { CurrencyConnector } from './core/connectors/currency/currency.connector.js';
import { GeocodeConnector } from './core/connectors/geocode/geocode.connector.js';
import { CryptoConnector } from './core/connectors/crypto/crypto.connector.js';
import { StocksConnector } from './core/connectors/stocks/stocks.connector.js';
import { RssConnector } from './core/connectors/rss/rss.connector.js';
import { WikipediaConnector } from './core/connectors/wikipedia/wikipedia.connector.js';
import { LocationConnector } from './core/connectors/location/location.connector.js';

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

  // Browser renderer — lazy, optional, best-effort
  let browserRenderer: BrowserRenderer | null = null;
  if (config.fetch.browserEnabled && await BrowserRenderer.isAvailable()) {
    browserRenderer = new BrowserRenderer(logger, config.fetch.browserTimeout);
    logger.info('Browser rendering enabled (Playwright available)');
  } else if (config.fetch.browserEnabled) {
    logger.info('Browser rendering enabled but Playwright not installed — browser fallback disabled');
  } else {
    logger.info('Browser rendering disabled via config');
  }

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
    browserRenderer,
  );

  // ── 6. Connectors ──────────────────────────────
  const weatherConnector = new WeatherConnector(logger, config);
  const timeConnector = new TimeConnector();
  const currencyConnector = new CurrencyConnector(logger, config);
  const geocodeConnector = new GeocodeConnector(logger, config);
  const cryptoConnector = new CryptoConnector(logger, config);
  const stocksConnector = new StocksConnector(logger, config);
  const rssConnector = new RssConnector(logger, config);
  const wikipediaConnector = new WikipediaConnector(logger, config);
  const locationConnector = new LocationConnector(logger, config);

  const toolServices = {
    searchService,
    fetchService,
    weatherConnector,
    timeConnector,
    currencyConnector,
    geocodeConnector,
    cryptoConnector,
    stocksConnector,
    rssConnector,
    wikipediaConnector,
    locationConnector,
  };

  // ── 7. MCP Server Factory ──────────────────────
  const createConfiguredServer = () => {
    const server = createMcpServer(config, logger);
    registerTools(server, toolServices, logger);
    return server;
  };

  // ── 8. Connect Transport ───────────────────────
  let transportCloser: { close: () => Promise<void> };

  if (config.transport.type === 'http') {
    transportCloser = await connectHttpTransport(createConfiguredServer, config, logger);
  } else {
    const mcpServer = createConfiguredServer();
    transportCloser = await connectStdioTransport(mcpServer, logger);
  }

  // ── 9. Graceful Shutdown ───────────────────────
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

    // Close browser renderer if active
    if (browserRenderer) {
      await browserRenderer.close();
    }

    await transportCloser.close();
    logger.info('Internet MCP stopped');

    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  logger.info({
    transport: config.transport.type,
    provider: activeProvider.name,
    tools: [
      'search_web', 'open_url',
      'get_weather', 'get_time', 'convert_currency',
      'geocode', 'get_crypto_price', 'get_stock_price', 'read_rss', 'wikipedia',
      'get_current_location',
    ],
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
