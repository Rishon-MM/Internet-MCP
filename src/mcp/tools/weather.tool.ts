import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { WeatherConnector } from '../../core/connectors/weather/weather.connector.js';
import type { Logger } from '../../shared/logger.js';

export function registerWeatherTool(
  server: McpServer,
  connector: WeatherConnector,
  logger: Logger,
): void {
  server.registerTool(
    'get_weather',
    {
      title: 'Get Weather',
      description:
        'Get current weather conditions and a 7-day forecast for a location. Provide latitude and longitude coordinates.',
      inputSchema: z.object({
        latitude: z.number().min(-90).max(90).describe('Latitude (-90 to 90)'),
        longitude: z.number().min(-180).max(180).describe('Longitude (-180 to 180)'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ latitude, longitude }) => {
      try {
        const result = await connector.getWeather(latitude, longitude);

        const lines: string[] = [
          `## Current Weather (${latitude}, ${longitude})`,
          '',
          `- **Temperature:** ${result.current.temperature}°C`,
          `- **Condition:** ${result.current.condition}`,
          `- **Humidity:** ${result.current.humidity}%`,
          `- **Wind Speed:** ${result.current.windSpeed} km/h`,
          `- **Day/Night:** ${result.current.isDay ? '☀️ Day' : '🌙 Night'}`,
          '',
          '## 7-Day Forecast',
          '',
          '| Date | Condition | Max | Min | Precip |',
          '|---|---|---|---|---|',
        ];

        for (const day of result.forecast) {
          lines.push(`| ${day.date} | ${day.condition} | ${day.maxTemp}°C | ${day.minTemp}°C | ${day.precipitation}mm |`);
        }

        lines.push('', '---', '*Data from Open-Meteo (open-meteo.com)*');

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (error) {
        logger.error({ tool: 'get_weather', latitude, longitude, error: error instanceof Error ? error.message : String(error) }, 'get_weather error');
        return { content: [{ type: 'text', text: `Weather lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}` }], isError: true };
      }
    },
  );

  logger.debug('Registered tool: get_weather');
}
