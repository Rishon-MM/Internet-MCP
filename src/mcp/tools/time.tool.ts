import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { TimeConnector } from '../../core/connectors/time/time.connector.js';
import type { Logger } from '../../shared/logger.js';

export function registerTimeTool(
  server: McpServer,
  connector: TimeConnector,
  logger: Logger,
): void {
  server.registerTool(
    'get_time',
    {
      title: 'Get Current Time',
      description:
        'Get the current time and date for a given timezone. Use IANA timezone format (e.g., "America/New_York", "Europe/London", "Asia/Tokyo").',
      inputSchema: z.object({
        timezone: z.string().min(1).describe('IANA timezone (e.g., "America/New_York", "Europe/London", "UTC")'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ timezone }) => {
      try {
        const result = connector.getTime(timezone);

        const lines: string[] = [
          `## Current Time — ${result.timezone}`,
          '',
          `- **Date & Time:** ${result.dateTime}`,
          `- **Date:** ${result.date}`,
          `- **Time:** ${result.time}`,
          `- **Day:** ${result.dayOfWeek}`,
          `- **UTC Offset:** ${result.utcOffset}`,
          `- **ISO 8601:** ${result.iso8601}`,
        ];

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (error) {
        logger.error({ tool: 'get_time', timezone, error: error instanceof Error ? error.message : String(error) }, 'get_time error');
        return { content: [{ type: 'text', text: `Time lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}` }], isError: true };
      }
    },
  );

  logger.debug('Registered tool: get_time');
}
