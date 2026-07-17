import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { SearchService } from '../core/retrieval/search/search.service.js';
import type { FetchService } from '../core/retrieval/fetch/fetch.service.js';
import type { WeatherConnector } from '../core/connectors/weather/weather.connector.js';
import type { TimeConnector } from '../core/connectors/time/time.connector.js';
import type { CurrencyConnector } from '../core/connectors/currency/currency.connector.js';
import type { GeocodeConnector } from '../core/connectors/geocode/geocode.connector.js';
import type { CryptoConnector } from '../core/connectors/crypto/crypto.connector.js';
import type { StocksConnector } from '../core/connectors/stocks/stocks.connector.js';
import type { RssConnector } from '../core/connectors/rss/rss.connector.js';
import type { Logger } from '../shared/logger.js';
import { registerSearchTool } from './tools/search.tool.js';
import { registerOpenUrlTool } from './tools/open-url.tool.js';
import { registerWeatherTool } from './tools/weather.tool.js';
import { registerTimeTool } from './tools/time.tool.js';
import { registerCurrencyTool } from './tools/currency.tool.js';
import { registerGeocodeTool } from './tools/geocode.tool.js';
import { registerCryptoTool } from './tools/crypto.tool.js';
import { registerStocksTool } from './tools/stocks.tool.js';
import { registerRssTool } from './tools/rss.tool.js';

/**
 * Services container — all services needed by MCP tools.
 */
export interface ToolServices {
  readonly searchService: SearchService;
  readonly fetchService: FetchService;
  readonly weatherConnector: WeatherConnector;
  readonly timeConnector: TimeConnector;
  readonly currencyConnector: CurrencyConnector;
  readonly geocodeConnector: GeocodeConnector;
  readonly cryptoConnector: CryptoConnector;
  readonly stocksConnector: StocksConnector;
  readonly rssConnector: RssConnector;
}

/**
 * Registers all MCP tools on the server.
 *
 * This is the single place where tools are wired to core services.
 * Each tool is a thin adapter — no business logic here.
 */
export function registerTools(
  server: McpServer,
  services: ToolServices,
  logger: Logger,
): void {
  // ── Retrieval Tools ──────────────────────────
  registerSearchTool(server, services.searchService, logger);
  registerOpenUrlTool(server, services.fetchService, logger);

  // ── Connector Tools ──────────────────────────
  registerWeatherTool(server, services.weatherConnector, logger);
  registerTimeTool(server, services.timeConnector, logger);
  registerCurrencyTool(server, services.currencyConnector, logger);
  registerGeocodeTool(server, services.geocodeConnector, logger);
  registerCryptoTool(server, services.cryptoConnector, logger);
  registerStocksTool(server, services.stocksConnector, logger);
  registerRssTool(server, services.rssConnector, logger);

  logger.info('All MCP tools registered');
}

export { z };
