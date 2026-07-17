import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { CurrencyConnector } from '../../core/connectors/currency/currency.connector.js';
import type { Logger } from '../../shared/logger.js';

export function registerCurrencyTool(
  server: McpServer,
  connector: CurrencyConnector,
  logger: Logger,
): void {
  server.registerTool(
    'convert_currency',
    {
      title: 'Convert Currency',
      description:
        'Convert an amount between currencies using ECB exchange rates. Use ISO 4217 currency codes (e.g., USD, EUR, GBP, JPY).',
      inputSchema: z.object({
        amount: z.number().positive().describe('Amount to convert'),
        from: z.string().length(3).describe('Source currency code (e.g., USD)'),
        to: z.string().length(3).describe('Target currency code (e.g., EUR)'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ amount, from, to }) => {
      try {
        const result = await connector.convert(amount, from, to);

        const lines: string[] = [
          `## Currency Conversion`,
          '',
          `**${result.amount} ${result.from}** = **${result.result} ${result.to}**`,
          '',
          `- **Rate:** 1 ${result.from} = ${result.rate.toFixed(4)} ${result.to}`,
          `- **Date:** ${result.date}`,
          '',
          '---',
          '*Data from European Central Bank via Frankfurter API*',
        ];

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (error) {
        logger.error({ tool: 'convert_currency', amount, from, to, error: error instanceof Error ? error.message : String(error) }, 'convert_currency error');
        return { content: [{ type: 'text', text: `Currency conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}` }], isError: true };
      }
    },
  );

  logger.debug('Registered tool: convert_currency');
}
