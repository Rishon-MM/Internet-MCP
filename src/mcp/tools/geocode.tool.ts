import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { GeocodeConnector } from '../../core/connectors/geocode/geocode.connector.js';
import type { Logger } from '../../shared/logger.js';

export function registerGeocodeTool(
  server: McpServer,
  connector: GeocodeConnector,
  logger: Logger,
): void {
  server.registerTool(
    'geocode',
    {
      title: 'Geocode',
      description:
        'Convert an address/place name to coordinates (forward geocoding), or coordinates to an address (reverse geocoding). For forward: provide "query". For reverse: provide "latitude" and "longitude".',
      inputSchema: z.object({
        query: z.string().optional().describe('Place name or address to geocode'),
        latitude: z.number().min(-90).max(90).optional().describe('Latitude for reverse geocoding'),
        longitude: z.number().min(-180).max(180).optional().describe('Longitude for reverse geocoding'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ query, latitude, longitude }) => {
      try {
        if (query) {
          // Forward geocode
          const results = await connector.geocode(query);

          if (results.length === 0) {
            return { content: [{ type: 'text', text: `No results found for "${query}"` }] };
          }

          const lines: string[] = [
            `## Geocode Results for "${query}"`,
            '',
          ];

          for (const [i, r] of results.entries()) {
            lines.push(`### ${i + 1}. ${r.displayName}`);
            lines.push(`- **Coordinates:** ${r.latitude}, ${r.longitude}`);
            lines.push(`- **Type:** ${r.type}`);
            lines.push('');
          }

          lines.push('---', '*Data from OpenStreetMap / Nominatim*');
          return { content: [{ type: 'text', text: lines.join('\n') }] };

        } else if (latitude !== undefined && longitude !== undefined) {
          // Reverse geocode
          const result = await connector.reverseGeocode(latitude, longitude);

          const lines: string[] = [
            `## Reverse Geocode (${latitude}, ${longitude})`,
            '',
            `**${result.displayName}**`,
            '',
          ];

          if (Object.keys(result.address).length > 0) {
            lines.push('| Field | Value |', '|---|---|');
            for (const [key, value] of Object.entries(result.address)) {
              lines.push(`| ${key} | ${value} |`);
            }
          }

          lines.push('', '---', '*Data from OpenStreetMap / Nominatim*');
          return { content: [{ type: 'text', text: lines.join('\n') }] };
        } else {
          return { content: [{ type: 'text', text: 'Please provide either a "query" for forward geocoding, or "latitude" and "longitude" for reverse geocoding.' }], isError: true };
        }
      } catch (error) {
        logger.error({ tool: 'geocode', query, latitude, longitude, error: error instanceof Error ? error.message : String(error) }, 'geocode error');
        return { content: [{ type: 'text', text: `Geocoding failed: ${error instanceof Error ? error.message : 'Unknown error'}` }], isError: true };
      }
    },
  );

  logger.debug('Registered tool: geocode');
}
