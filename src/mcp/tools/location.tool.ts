import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { LocationConnector } from '../../core/connectors/location/location.connector.js';
import type { Logger } from '../../shared/logger.js';

export function registerLocationTool(
  server: McpServer,
  connector: LocationConnector,
  logger: Logger,
): void {
  server.registerTool(
    'get_current_location',
    {
      title: 'Get Current Location',
      description:
        'Get the current geographic location. On Windows, tries Location Services (GPS/Wi-Fi/Bluetooth) first for high accuracy. Falls back to IP-based geolocation if unavailable. No input required. Returns coordinates, address, and source reliability.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () => {
      try {
        const result = await connector.getCurrentLocation();

        const lines: string[] = [];

        // Header with source badge
        if (result.source === 'windows') {
          const acc = result.accuracy !== undefined ? ` (±${Math.round(result.accuracy)}m)` : '';
          lines.push(
            `## 📍 Current Location`,
            '',
            `> **Source:** Windows Location Services${acc} — *high reliability*`,
          );
        } else {
          lines.push(
            `## 📍 Current Location ${result.flagEmoji ?? ''}`.trim(),
            '',
            `> **Source:** IP Geolocation — *approximate*`,
          );
        }

        lines.push('');

        // Coordinates (always present)
        lines.push(`- **Coordinates:** ${result.latitude}, ${result.longitude}`);

        // Address fields (when available)
        if (result.displayAddress) {
          lines.push(`- **Address:** ${result.displayAddress}`);
        }
        if (result.city) {
          lines.push(`- **City:** ${result.city}`);
        }
        if (result.region) {
          lines.push(`- **Region:** ${result.region}`);
        }
        if (result.country) {
          const cc = result.countryCode ? ` (${result.countryCode})` : '';
          lines.push(`- **Country:** ${result.country}${cc}`);
        }
        if (result.postal) {
          lines.push(`- **Postal Code:** ${result.postal}`);
        }
        if (result.timezone) {
          lines.push(`- **Timezone:** ${result.timezone}`);
        }

        // IP-specific fields
        if (result.ip) {
          lines.push(`- **IP:** ${result.ip}`);
        }
        if (result.isp) {
          lines.push(`- **ISP:** ${result.isp}`);
        }

        // Timestamp
        lines.push(`- **Timestamp:** ${result.timestamp}`);

        // Footer
        lines.push('', '---');
        if (result.source === 'windows') {
          lines.push('*Location from Windows Location Services, address from OpenStreetMap/Nominatim*');
        } else {
          lines.push('*Location from ipwho.is (IP-based geolocation)*');
        }

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (error) {
        logger.error({ tool: 'get_current_location', error: error instanceof Error ? error.message : String(error) }, 'get_current_location error');
        return { content: [{ type: 'text', text: `Location lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}` }], isError: true };
      }
    },
  );

  logger.debug('Registered tool: get_current_location');
}
