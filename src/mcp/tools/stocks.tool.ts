import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { StocksConnector } from '../../core/connectors/stocks/stocks.connector.js';
import type { Logger } from '../../shared/logger.js';

export function registerStocksTool(
  server: McpServer,
  connector: StocksConnector,
  logger: Logger,
): void {
  server.registerTool(
    'get_stock_price',
    {
      title: 'Get Stock Price',
      description:
        'Get the current stock price, change, and market data. Use standard ticker symbols (e.g., AAPL, MSFT, TSLA, GOOGL).',
      inputSchema: z.object({
        symbol: z.string().min(1).max(10).describe('Stock ticker symbol (e.g., AAPL, MSFT)'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ symbol }) => {
      try {
        const result = await connector.getQuote(symbol);

        const changeEmoji = result.change >= 0 ? '📈' : '📉';

        const lines: string[] = [
          `## ${result.symbol} — Stock Quote`,
          '',
          `- **Price:** ${result.price} ${result.currency}`,
          `- **Change:** ${changeEmoji} ${result.change >= 0 ? '+' : ''}${result.change} (${result.changePercent >= 0 ? '+' : ''}${result.changePercent}%)`,
          `- **Previous Close:** ${result.previousClose} ${result.currency}`,
          `- **Exchange:** ${result.exchange}`,
          `- **Last Updated:** ${result.lastUpdated}`,
          '',
          '---',
          '*Data from Yahoo Finance*',
        ];

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (error) {
        logger.error({ tool: 'get_stock_price', symbol, error: error instanceof Error ? error.message : String(error) }, 'get_stock_price error');
        return { content: [{ type: 'text', text: `Stock price lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}` }], isError: true };
      }
    },
  );

  logger.debug('Registered tool: get_stock_price');
}
