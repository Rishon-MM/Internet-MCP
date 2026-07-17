import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { CryptoConnector } from '../../core/connectors/crypto/crypto.connector.js';
import type { Logger } from '../../shared/logger.js';

export function registerCryptoTool(
  server: McpServer,
  connector: CryptoConnector,
  logger: Logger,
): void {
  server.registerTool(
    'get_crypto_price',
    {
      title: 'Get Cryptocurrency Price',
      description:
        'Get the current price, market cap, and 24h change for a cryptocurrency. Use CoinGecko coin IDs (e.g., "bitcoin", "ethereum", "solana", "dogecoin").',
      inputSchema: z.object({
        coin_id: z.string().min(1).describe('CoinGecko coin ID (e.g., "bitcoin", "ethereum")'),
        vs_currency: z.string().default('usd').describe('Currency to price against (default: "usd")'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ coin_id, vs_currency }) => {
      try {
        const result = await connector.getPrice(coin_id, vs_currency);

        const changeEmoji = result.change24h >= 0 ? '📈' : '📉';
        const currency = result.currency.toUpperCase();

        const lines: string[] = [
          `## ${coin_id.charAt(0).toUpperCase() + coin_id.slice(1)} (${currency})`,
          '',
          `- **Price:** ${formatNumber(result.price)} ${currency}`,
          `- **24h Change:** ${changeEmoji} ${result.change24h >= 0 ? '+' : ''}${result.change24h.toFixed(2)}%`,
          `- **Market Cap:** ${formatLargeNumber(result.marketCap)} ${currency}`,
          `- **24h Volume:** ${formatLargeNumber(result.volume24h)} ${currency}`,
          `- **Last Updated:** ${result.lastUpdated}`,
          '',
          '---',
          '*Data from CoinGecko*',
        ];

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (error) {
        logger.error({ tool: 'get_crypto_price', coin_id, vs_currency, error: error instanceof Error ? error.message : String(error) }, 'get_crypto_price error');
        return { content: [{ type: 'text', text: `Crypto price lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}` }], isError: true };
      }
    },
  );

  logger.debug('Registered tool: get_crypto_price');
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function formatLargeNumber(n: number): string {
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  return n.toLocaleString('en-US');
}
